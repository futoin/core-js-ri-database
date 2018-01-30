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
const _values = require( 'lodash/values' );
const sqlite3 = require( 'sqlite3' );
const L2Service = require( './L2Service' );
const SQLiteDriver = require( './SQLiteDriver' );
const Mutex = require( 'futoin-asyncsteps/Mutex' );


/**
 * SQLite service implementation for FutoIn Database interface.addEventListener()
 */
class SQLiteService extends L2Service
{
    /**
     * Please use SQLiteService.register() for proper setup.
     * @param {object} options - see SQLiteService.register() for common options
     * @param {objecT} [options.raw={}] - raw options
     * @param {string} [options.raw.filename=options.port] - database file
     * @param {integer} [options.raw.mode=OPEN_READWRITE|OPEN_CREATE|SQLITE_OPEN_FULLMUTEX] - open mode
     * @param {integer} [options.raw.busyTimeout=10000] - busyTimeout configuration value
     * @param {array} [options.raw.pragma=[]] - list of pragma statements to execute on DB open
     * @note database filename is to supplied in options.port parameter.
     */
    constructor( options )
    {
        super( new SQLiteDriver );

        const raw = options.raw ? _cloneDeep( options.raw ) : {};
        _defaults( raw, {
            mode : sqlite3.OPEN_READWRITE |
                sqlite3.OPEN_CREATE |
                sqlite3.SQLITE_OPEN_FULLMUTEX,
            busyTimeout: 10e3,
            pragmas: [],
        } );

        if ( options.port )
        {
            raw.filename = options.port;
        }

        this._db = null;
        this._db_params = raw;
        this._mutex = new Mutex();
    }

    _close()
    {
        if ( this._db )
        {
            this._db.close();
            this._db = null;
        }
    }

    _withDatabase( as, cb )
    {
        as.sync( this._mutex, ( as ) =>
        {
            if ( !this._db )
            {
                as.add( ( as ) =>
                {
                    const params = this._db_params;
                    const db = new sqlite3.Database(
                        params.filename,
                        params.mode,
                        ( err ) =>
                        {
                            if ( !as.state )
                            {
                                // ignore
                            }
                            else if ( err )
                            {
                                this._handleError( as, err );
                            }
                            else if ( as.state )
                            {
                                db.configure( 'busyTimeout', params.busyTimeout );

                                this._db = db;
                                as.success();
                            }
                        }
                    );

                    as.setCancel( ( as ) =>
                    {
                        if ( !this._db )
                        {
                            db.close();
                        }
                    } );
                } );
                as.add( ( as ) =>
                {
                    const db = this._db;
                    as.forEach( this._db_params.pragmas, ( as, _i, v ) =>
                    {
                        this._query( as, db, `PRAGMA ${v}` );
                    } );
                } );
            }

            as.add( ( as ) =>
            {
                cb( as, this._db );
            } );
        } );
    }

    _handleError( as, err )
    {
        try
        {
            const code = err.code;

            switch ( code )
            {
            case 'SQLITE_CONSTRAINT':
            case 'SQLITE_CONSTRAINT_UNIQUE':
                as.error( 'Duplicate', err.message );
                break;

            case 'SQLITE_MISMATCH':
            case 'SQLITE_ERROR':
            case 'SQLITE_MISUSE':
            case 'SQLITE_SCHEMA':
                as.error( 'InvalidQuery', err.message );
                break;

            case 'SQLITE_LOCKED':
                as.error( 'DeadLock', err.message );
                break;

            default:
                as.error( 'OtherExecError', err.message );
            }
        }
        catch ( e )
        {
            // ignore
        }
    }

    _query( as, db, q, cb=null )
    {
        as.waitExternal();

        // Note: with. ...is not covered
        if ( q.match( /^\s*(UPDATE|INSERT|DELETE|BEGIN|COMMIT)\s/i ) )
        {
            const that = this;

            db.run( q, function( err )
            {
                if ( !as.state )
                {
                    return;
                }

                if ( err )
                {
                    that._handleError( as, err );
                    return;
                }

                if ( cb )
                {
                    let res;

                    if ( q.match( /^\s*INSERT\s/i ) )
                    {
                        res = {
                            rows: [ [ this.lastID ] ],
                            fields: [ '$id' ],
                            affected: this.changes,
                        };
                    }
                    else
                    {
                        res = {
                            rows: [],
                            fields: [],
                            affected: this.changes,
                        };
                    }

                    try
                    {
                        cb( as, res );
                    }
                    catch ( e )
                    {
                        return;
                    }
                }

                as.success();
            } );
        }
        else
        {
            db.all( q, ( err, rows ) =>
            {
                if ( !as.state )
                {
                    return;
                }

                if ( err )
                {
                    this._handleError( as, err );
                }
                else if ( rows.length > this.MAX_ROWS )
                {
                    try
                    {
                        as.error( 'LimitTooHigh' );
                    }
                    catch ( e )
                    {
                        // ignore
                    }
                }
                else
                {
                    if ( cb )
                    {
                        let res;

                        if ( rows.length === 0 )
                        {
                            res = {
                                rows: [],
                                fields: [],
                                affected: 0,
                            };
                        }
                        else
                        {
                            const fields = Object.keys( rows[0] );
                            rows = rows.map( ( v ) => _values( v ) );

                            res = {
                                rows,
                                fields,
                                affected: 0,
                            };
                        }

                        try
                        {
                            cb( as, res );
                        }
                        catch ( e )
                        {
                            return;
                        }
                    }

                    as.success();
                }
            } );
        }
    }

    query( as, reqinfo )
    {
        this._withDatabase( as, ( as, db ) =>
        {
            this._query( as, db, reqinfo.params().q, ( as, res ) =>
            {
                reqinfo.result( res );
            } );
        } );
    }

    callStored( as, _reqinfo )
    {
        as.error( 'InvalidQuery', 'SQLite does not support stored procedures' );
    }

    getFlavour( as, reqinfo )
    {
        reqinfo.result( 'sqlite' );
    }

    xfer( as, reqinfo )
    {
        const p = reqinfo.params();

        this._withDatabase( as, ( as, db ) =>
        {
            const ql = p.ql;
            const prev_results = [];
            const results = [];

            as.add(
                ( as ) =>
                {
                    // Begin
                    as.add( ( as ) =>
                    {
                        this._query( as, db, 'BEGIN EXCLUSIVE' );
                    } );

                    // Loop through query list
                    as.forEach( ql, ( as, stmt_id, xfer ) =>
                    {
                        as.add( ( as ) =>
                        {
                            const q = this._xferTemplate( as, xfer, prev_results );
                            this._query( as, db, q, ( as, qres ) =>
                            {
                                prev_results.push( qres );
                                this._xferCommon(
                                    as, xfer, [ qres ], stmt_id, results, q );
                            } );
                        } );
                    } );

                    // Commit
                    as.add( ( as ) =>
                    {
                        reqinfo.result( results );
                        this._query( as, db, 'COMMIT' );
                    } );
                },
                ( as, err ) =>
                {
                    db.run( 'ROLLBACK' );
                }
            );
        } );
    }
}

module.exports = SQLiteService;
