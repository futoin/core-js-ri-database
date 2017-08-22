'use strict';

const _cloneDeep = require( 'lodash/cloneDeep' );
const _defaults = require( 'lodash/defaults' );

if ( typeof process.env.NODE_PG_FORCE_NATIVE !== 'undefined' )
{
    throw new Error( 'pg-cursor does not work with pg-native (NODE_PG_FORCE_NATIVE)' );
}

const { Pool, types } = require( 'pg' );
const Cursor = require( 'pg-cursor' );
const L2Service = require( './L2Service' );

const IsoLevels = {
    RU: 'READ UNCOMMITTED',
    RC: 'READ COMMITTED',
    RR: 'REPEATABLE READ',
    SRL: 'SERIALIZABLE',
};

// Do not wrap dates into Date()
// See pg-types/lib/textParsers.js
types.setTypeParser( 1082, ( v ) => v ); // Date
types.setTypeParser( 1114, ( v ) => v ); // Timestamp
types.setTypeParser( 1184, ( v ) => v ); // Timestampt with TZ

/**
 * PostgreSQL service implementation for FutoIn Database interface
 */
class PostgreSQLService extends L2Service
{
    constructor( options )
    {
        super();

        const raw = options.raw ? _cloneDeep( options.raw ) : {};
        _defaults( raw, {
            connectionTimeoutMillis: 3e3,
            idleTimeoutMillis: 10e3,
            acquireTimeout: 5000,
        } );

        raw.max = options.conn_limit || 1;

        for ( let f of [ 'host', 'port', 'user', 'password', 'database' ] )
        {
            const val = options[f];

            if ( val )
            {
                raw[f] = val;
            }
        }

        const pool = new Pool( raw );

        this._pool = pool;
    }

    _cursorBugWorkaround( conn )
    {
        // Workaround for pg-cursor#31: 
        // https://github.com/brianc/node-pg-cursor/issues/31
        const raw_conn = conn.connection;
        const rd_listeners = raw_conn.listeners( 'rowDescription' );

        for ( let i = rd_listeners.length - 1; i > 0; --i )
        {
            raw_conn.removeListener(
                'rowDescription',
                rd_listeners[i] );
        }
    }

    _withConnection( as, callback )
    {
        const isol = 'RC';

        const releaseConn = ( as ) =>
        {
            const state = as.state;
            const release = state.dbRelease;

            if ( release )
            {
                const conn = state.dbConn;
                state.dbConn = null;
                state.dbRelease = null;

                this._cursorBugWorkaround( conn );

                release();
            }
        };

        as.add(
            ( as ) =>
            {
                as.setCancel( ( as ) =>
                {} );

                this._pool.connect( ( err, conn, release ) =>
                {
                    const state = as.state;

                    if ( !state )
                    {
                        if ( release )
                        {
                            release();
                        }

                        return;
                    }

                    if ( err )
                    {
                        try
                        {
                            state.last_db_error= err;
                            state.last_exception = err;
                            as.error( err.code );
                        }
                        catch ( e )
                        {
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
            ( as, conn ) =>
            {
                if ( conn._futoin_isol !== isol )
                {
                    as.add( ( as ) =>
                    {
                        const q = (
                            'SET SESSION CHARACTERISTICS AS ' +
                            'TRANSACTION ISOLATION '+
                            `LEVEL ${IsoLevels[isol]}`
                        );
                        const dbq = conn.query( new Cursor( q ) );
                        this._handleResult( as, dbq );
                    } );

                    as.add( ( as ) =>
                    {
                        conn._futoin_isol = isol;
                        callback( as, conn );
                    } );
                }
                else
                {
                    callback( as, conn );
                }
            },
            ( as, err ) => releaseConn( as )
        );
        as.add( releaseConn );
    }

    _handleCursorRead( as, err, rows, result, cb )
    {
        // Cancel
        if ( !as.state )
        {
            return;
        }

        // Fail
        if ( err )
        {
            try
            {
                switch ( err.code )
                {
                case '23505':
                    as.error( 'Duplicate' );
                    break;

                case '42601':
                    as.error( 'InvalidQuery' );
                    break;

                case '40P01':
                    as.error( 'DeadLock' );
                    break;

                default:
                    as.error( 'OtherExecError',
                        `${err.code}: ${err.message}` );
                }
            }
            catch ( e )
            {
                return;
            }
        }

        if ( rows.length > this.MAX_ROWS )
        {
            try
            {
                as.error( 'LimitTooHigh' );
            }
            catch ( e )
            {
                return;
            }
        }

        // OK
        if ( cb )
        {
            const fields = result.fields.map( ( v ) => v.name );
            const res = {
                rows,
                fields,
                affected: result.rowCount || 0,
            };
            cb( res );
        }

        as.success();
    }

    _handleResult( as, cursor, cb=null )
    {
        as.setCancel( ( as ) =>
        {
            if ( cursor.state === 'busy' )
            {
                cursor.end();
            }
        } );

        cursor.read( this.MAX_ROWS + 1, ( err, rows, result ) =>
        {
            try
            {
                this._handleCursorRead( as, err, rows, result, cb );
            }
            catch ( e )
            {
                try
                {
                    as.error( 'OtherExecError', `${e}` );
                }
                catch ( e )
                {
                    // pass
                }
            }
        } );
    }

    query( as, reqinfo )
    {
        const q = reqinfo.params().q.trim();

        if ( !q.length )
        {
            as.error( 'InvalidQuery' );
        }

        this._withConnection( as, ( as, conn ) =>
        {
            const c = new Cursor( q, null, { rowMode: 'array' } );
            const dbq = conn.query( c );
            this._handleResult( as, dbq, ( res ) => reqinfo.result( res ) );
        } );
    }

    callStored( as, reqinfo )
    {
        this._withConnection( as, ( as, conn ) =>
        {
            const p = reqinfo.params();
            const args = p.args;
            const placeholders = args.map( ( _v, i ) => `$${i+1}` ).join( ',' );
            const q = `SELECT * FROM ${p.name}(${placeholders})`;
            const c = new Cursor( q, args, { rowMode: 'array' } );
            const dbq = conn.query( c );
            this._handleResult( as, dbq, ( res ) => reqinfo.result( res ) );
        } );
    }

    getFlavour( as, reqinfo )
    {
        reqinfo.result( 'postgresql' );
    }

    xfer( as, reqinfo )
    {
        this._withConnection( as, ( as, conn ) =>
        {
            as.add(
                ( as ) =>
                {
                    const p = reqinfo.params();
                    const ql = p.ql;
                    const results = [];

                    // Begin
                    as.add( ( as ) =>
                    {
                        const q = (
                            'START TRANSACTION ' +
                            `ISOLATION LEVEL ${IsoLevels[p.isol]}`
                        );
                        const c = new Cursor( q );
                        const dbq = conn.query( c );
                        this._handleResult( as, dbq );
                    } );

                    // Loop through query list
                    as.forEach( ql, ( as, stmt_id, xfer ) =>
                    {
                        this._cursorBugWorkaround( conn );

                        const c = new Cursor( xfer.q, null, { rowMode: 'array' } );
                        const dbq = conn.query( c );
                        this._handleResult( as, dbq,
                            ( res ) => this._xferCommon(
                                as, xfer, [ res ], stmt_id, results )
                        );
                    } );

                    // Commit
                    as.add( ( as ) =>
                    {
                        reqinfo.result( results );

                        const dbq = conn.query( new Cursor( 'COMMIT' ) );
                        this._handleResult( as, dbq );
                    } );
                },
                ( as, err ) =>
                {
                    const dbq = conn.query( new Cursor( 'ROLLBACK' ) );
                    this._handleResult( as, dbq );
                }
            );
        } );
    }
}

module.exports = PostgreSQLService;
