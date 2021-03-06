'use strict';

/**
 * @file
 *
 * Copyright 2017 FutoIn Project (https://futoin.org)
 * Copyright 2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const _cloneDeep = require( 'lodash/cloneDeep' );
const _defaults = require( 'lodash/defaults' );

const pg = require( 'pg' );
// const Pool = pg.native ? pg.native.Pool : pg.Pool;
const Pool = pg.Pool;

if ( typeof process.env.NODE_PG_FORCE_NATIVE !== 'undefined' ) {
    throw new Error( 'NODE_PG_FORCE_NATIVE is not supported yet' );
}


const L2Service = require( './L2Service' );
const PostgreSQLDriver = require( './PostgreSQLDriver' );

const IsoLevels = {
    RU: 'READ UNCOMMITTED',
    RC: 'READ COMMITTED',
    RR: 'REPEATABLE READ',
    SRL: 'SERIALIZABLE',
};

// Do not wrap dates into Date()
// See pg-types/lib/textParsers.js
const pg_types = pg.types;
const arrayParser = require( 'pg-types/lib/arrayParser' );

const parseStringArray = function( value ) {
    if( !value ) {
        return null;
    }

    return arrayParser.create( value ).parse();
};

pg_types.setTypeParser( 1082, ( v ) => v ); // Date
pg_types.setTypeParser( 1114, ( v ) => v ); // Timestamp
pg_types.setTypeParser( 1184, ( v ) => v ); // Timestampt with TZ
pg_types.setTypeParser( 1115, parseStringArray ); // timestamp without time zone[]
pg_types.setTypeParser( 1182, parseStringArray ); // _date
pg_types.setTypeParser( 1185, parseStringArray ); // timestamp with time zone[]
pg_types.setTypeParser( 114, ( v ) => v ); // json
pg_types.setTypeParser( 3802, ( v ) => v ); // jsonb
pg_types.setTypeParser( 199, parseStringArray ); // json[]
pg_types.setTypeParser( 3807, parseStringArray ); // jsonb[]

/**
 * PostgreSQL service implementation for FutoIn Database interface
 */
class PostgreSQLService extends L2Service {
    constructor( options ) {
        super( new PostgreSQLDriver );

        const raw = options.raw ? _cloneDeep( options.raw ) : {};
        _defaults( raw, {
            connectionTimeoutMillis: 3e3,
            idleTimeoutMillis: 10e3,
            acquireTimeout: 5000,
        } );

        raw.max = options.conn_limit || 1;

        for ( let f of [
            'host',
            'port',
            'user',
            'password',
            'database',
        ] ) {
            const val = options[f];

            if ( val ) {
                raw[f] = val;
            }
        }

        const pool = new Pool( raw );

        this._pool = pool;
    }

    _close() {
        this._pool.end();
    }

    _withConnection( as, callback ) {
        const isol = 'RC';

        const releaseConn = ( as ) => {
            const state = as.state;
            const release = state.dbRelease;

            if ( release ) {
                state.dbConn = null;
                state.dbRelease = null;

                release();
            }
        };

        as.add(
            ( as ) => {
                as.waitExternal();

                this._pool.connect( ( err, conn, release ) => {
                    const state = as.state;

                    if ( !state ) {
                        if ( release ) {
                            release();
                        }

                        return;
                    }

                    if ( err ) {
                        try {
                            state.last_db_error= err;
                            state.last_exception = err;
                            as.error( err.code );
                        } catch ( e ) {
                            return;
                        }
                    }

                    state.dbConn = conn;
                    state.dbRelease = release;
                    as.success( conn );
                } );
            },
            ( as, err ) => releaseConn( as )
        );
        as.add(
            ( as, conn ) => {
                if ( conn._futoin_isol !== isol ) {
                    as.add( ( as ) => {
                        const q = (
                            'SET SESSION CHARACTERISTICS AS ' +
                            'TRANSACTION ISOLATION '+
                            `LEVEL ${IsoLevels[isol]}`
                        );
                        const dbq = conn.query( q );
                        this._handleResult( as, dbq );
                    } );

                    as.add( ( as ) => {
                        const q = 'SET SESSION TIME ZONE \'UTC\'';
                        const dbq = conn.query( q );
                        this._handleResult( as, dbq );
                    } );

                    as.add( ( as ) => {
                        conn._futoin_isol = isol;
                        callback( as, conn );
                    } );
                } else {
                    callback( as, conn );
                }
            },
            ( as, err ) => releaseConn( as )
        );
        as.add( releaseConn );
    }

    _handleResult( as, dbq, cb=null ) {
        as.waitExternal();

        dbq
            .then( ( r ) => {
                if ( !as.state ) {
                    return;
                }

                if ( cb ) {
                    const rows = r.rows;

                    if ( rows.length > this.MAX_ROWS ) {
                        try {
                            as.error( 'LimitTooHigh' );
                        } catch ( e ) {
                            return;
                        }
                    }

                    const fields = r.fields ? r.fields.map( ( v ) => v.name ) : [];
                    const affected = ( r.command === 'SELECT' ) ? 0 : ( r.rowCount || 0 );
                    const res = {
                        rows,
                        fields,
                        affected,
                    };

                    try {
                        cb( res );
                    } catch ( e ) {
                        return;
                    }
                }

                as.success();
            } )
            .catch( ( err ) => {
                if ( !as.state ) return;

                as.state.last_db_error= err;
                as.state.last_exception = err;
                const code = err.code;

                try {
                    switch ( code ) {
                    case '23505':
                        as.error( 'Duplicate', err.message );
                        break;

                    case '42601':
                        as.error( 'InvalidQuery', err.message );
                        break;

                    case '40P01':
                        as.error( 'DeadLock', err.message );
                        break;

                    default:
                        as.error( 'OtherExecError',
                            `${code}: ${err.message}` );
                    }
                } catch ( e ) {
                    // ignore
                }
            } );
    }

    query( as, reqinfo ) {
        const q = reqinfo.params().q.trim();

        if ( !q.length ) {
            as.error( 'InvalidQuery' );
        }

        this._withConnection( as, ( as, conn ) => {
            const dbq = conn.query( {
                text: q,
                rowMode: 'array',
            } );
            this._handleResult( as, dbq, ( res ) => reqinfo.result( res ) );
        } );
    }

    callStored( as, reqinfo ) {
        this._withConnection( as, ( as, conn ) => {
            const p = reqinfo.params();
            const args = p.args;
            const placeholders = args.map( ( _v, i ) => `$${i+1}` ).join( ',' );
            const q = `SELECT * FROM ${p.name}(${placeholders})`;
            const dbq = conn.query( {
                text: q,
                values: args,
                rowMode: 'array',
            } );
            this._handleResult( as, dbq, ( res ) => reqinfo.result( res ) );
        } );
    }

    getFlavour( as, reqinfo ) {
        reqinfo.result( 'postgresql' );
    }

    xfer( as, reqinfo ) {
        this._withConnection( as, ( as, conn ) => {
            as.add(
                ( as ) => {
                    const p = reqinfo.params();
                    const ql = p.ql;
                    const prev_results = [];
                    const results = [];

                    // Begin
                    as.add( ( as ) => {
                        const q = (
                            'START TRANSACTION ' +
                            `ISOLATION LEVEL ${IsoLevels[p.isol]}`
                        );
                        const dbq = conn.query( q );
                        this._handleResult( as, dbq );
                    } );

                    // Loop through query list
                    as.forEach( ql, ( as, stmt_id, xfer ) => {
                        const q = this._xferTemplate( as, xfer, prev_results );
                        const dbq = conn.query( {
                            text: q,
                            rowMode: 'array',
                        } );
                        this._handleResult( as, dbq,
                            ( qres ) => {
                                prev_results.push( qres );
                                this._xferCommon(
                                    as, xfer, [ qres ], stmt_id, results, q );
                            }
                        );
                    } );

                    // Commit
                    as.add( ( as ) => {
                        reqinfo.result( results );

                        const dbq = conn.query( 'COMMIT' );
                        this._handleResult( as, dbq );
                    } );
                },
                ( as, err ) => {
                    conn.query( 'ROLLBACK' );
                }
            );
        } );
    }
}

module.exports = PostgreSQLService;
