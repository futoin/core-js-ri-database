'use strict';

const _cloneDeep = require( 'lodash/cloneDeep' );
const _defaults = require( 'lodash/defaults' );

const { Pool } = require( 'pg' );
const Cursor = require( 'pg-cursor' );
const L2Service = require( './L2Service' );

const IsoLevels = {
    RU: 'READ UNCOMMITTED',
    RC: 'READ COMMITTED',
    RR: 'REPEATABLE READ',
    SRL: 'SERIALIZABLE',
};

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
    _withConnection( as, callback )
    {
        const isol = 'RC';

        const releaseConn = ( as ) =>
        {
            const state = as.state;
            const release = state.dbRelease;

            if ( release )
            {
                state.dbConn = null;
                state.dbRelease = null;

                release();
            }
        };

        as.add(
            ( as ) =>
            {
                as.setCancel( ( as ) =>
                {
                    const state = as.state;
                    const conn = state.dbConn;

                    if ( conn )
                    {
                        conn.end();
                        state.dbConn = null;
                        state.dbRelease = null;
                    }
                } );

                this._pool.connect( ( err, conn, release ) =>
                {
                    if ( !as.state )
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
                            as.state.last_db_error= err;
                            as.state.last_exception = err;
                            as.error( err.code );
                        }
                        catch ( e )
                        {
                            return;
                        }
                    }

                    as.state.dbConn = conn;
                    as.state.dbRelease = release;
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
                    as.error( 'OtherExecError' );
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
            const q = `SELECT * FROM ${p.name}($args)`;
            const c = new Cursor( q, { args }, { rowMode: 'array' } );
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
        as.error( 'TODO' );
        void reqinfo;
    }
}

module.exports = PostgreSQLService;
