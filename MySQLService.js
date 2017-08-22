'use strict';

const _cloneDeep = require( 'lodash/cloneDeep' );
const _defaults = require( 'lodash/defaults' );
const mysql = require( 'mysql' );
const L2Service = require( './L2Service' );

const IsoLevels = {
    RU: 'READ UNCOMMITTED',
    RC: 'READ COMMITTED',
    RR: 'REPEATABLE READ',
    SRL: 'SERIALIZABLE',
};

/**
 * MySQL service implementation for FutoIn Database interface.addEventListener()
 * 
 * @note If host is localhost then 'socketPath' is from 'port' option.
 */
class MySQLService extends L2Service
{
    constructor( options )
    {
        super();

        const raw = options.raw ? _cloneDeep( options.raw ) : {};
        _defaults( raw, {
            connectTimeout: 3000,
            acquireTimeout: 5000,
            waitForConnections: true,
            queueLimit: 0,
        } );

        raw.timezone = 'Z';
        raw.supportBigNumbers = true;
        raw.bigNumberStrings = true;
        raw.dateStrings = true;
        raw.multipleStatements = false;
        raw.flags = mysql.MULTI_RESULTS |
                    mysql.PS_MULTI_RESULTS |
                    mysql.TRANSACTIONS;
        raw.connectionLimit = options.conn_limit || 1;

        for ( let f of [ 'host', 'port', 'user', 'password', 'database' ] )
        {
            const val = options[f];

            if ( val )
            {
                raw[f] = val;
            }
        }

        if ( raw.host === 'localhost' )
        {
            raw.socketPath = raw.port;
        }

        const pool = mysql.createPool( raw );

        this._pool = pool;
    }

    _close()
    {
        this._pool.end();
    }

    _withConnection( as, isol, callback )
    {
        const releaseConn = ( as ) =>
        {
            const state = as.state;
            const conn = state.dbConn;

            if ( conn )
            {
                conn.release();
                state.dbConn = null;
            }
        };

        as.add(
            ( as ) =>
            {
                as.setCancel( ( as ) =>
                {} );

                this._pool.getConnection( ( err, conn ) =>
                {
                    if ( !as.state )
                    {
                        if ( conn )
                        {
                            conn.release();
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
                    as.success( conn );
                } );
            },
            ( as, err ) => releaseConn( as )
        );
        as.add(
            ( as, conn ) =>
            {
                if ( !conn._futoin_isol )
                {
                    as.add( ( as ) =>
                    {
                        const q = 'SET AUTOCOMMIT = 1';
                        const dbq = conn.query( q );
                        this._handleResult( as, dbq );
                    } );
                }

                if ( conn._futoin_isol !== isol )
                {
                    as.add( ( as ) =>
                    {
                        const q = `SET SESSION TRANSACTION ISOLATION LEVEL ${IsoLevels[isol]}`;
                        const dbq = conn.query( q );
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

    _handleResult( as, dbq, multi=false, cb=null )
    {
        as.setCancel( ( as ) => null );

        let rows = null;
        let fields = null;
        let res = null;
        let multi_res = [];
        const MAX_ROWS = this.MAX_ROWS;

        dbq.on( 'fields', ( packets, stmt_id ) =>
        {
            if ( stmt_id && !multi )
            {
                if ( !as.state ) return;

                try
                {
                    as.error( 'InvalidQuery', 'More than one result' );
                }
                catch ( e )
                {
                    return;
                }
            }

            rows = [];
            fields = packets.map( ( v ) => v.name );
            res = {
                rows,
                fields,
                affected: 0,
            };
            multi_res.push( res );
        } );

        dbq.on( 'result', ( packet, stmt_id ) =>
        {
            if ( stmt_id && !multi )
            {
                if ( !as.state ) return;

                try
                {
                    as.error( 'InvalidQuery', 'More than one result' );
                }
                catch ( e )
                {
                    return;
                }
            }

            const affected = packet.affectedRows;

            if ( affected !== undefined )
            {
                rows = null;
                fields = null;
                res = {
                    rows: [],
                    fields: [],
                    affected,
                };
                multi_res.push( res );
            }
            else if ( rows.length <= MAX_ROWS )
            {
                const row = fields.map( ( v ) => packet[v] );
                rows.push( row );
            }
            else if ( as.state )
            {
                const conn = as.state.dbConn;
                as.state.dbConn = null;
                conn.destroy();

                try
                {
                    as.error( 'LimitTooHigh' );
                }
                catch ( e )
                {
                    // ignore
                }
            }
        } );

        dbq.on( 'error', ( err ) =>
        {
            if ( !as.state ) return;

            as.state.last_db_error= err;
            as.state.last_exception = err;
            const code = err.code;

            try
            {
                switch ( code )
                {
                case 'ER_DUP_ENTRY':
                    as.error( 'Duplicate' );
                    break;

                case 'ER_EMPTY_QUERY':
                case 'ER_SYNTAX_ERROR':
                case 'ER_PARSE_ERROR':
                    as.error( 'InvalidQuery' );
                    break;

                case 'ER_LOCK_DEADLOCK':
                    as.error( 'DeadLock' );
                    break;

                default:
                    as.error( 'OtherExecError', code );
                }
            }
            catch ( e )
            {
                // ignore
            }
        } );

        dbq.on( 'end', () =>
        {
            if ( as.state )
            {
                if ( cb )
                {
                    try
                    {
                        cb( multi ? multi_res : res );
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

    query( as, reqinfo )
    {
        this._withConnection( as, 'RC', ( as, conn ) =>
        {
            this._handleResult( as, conn.query( reqinfo.params().q ), false,
                ( res ) => reqinfo.result( res ) );
        } );
    }

    callStored( as, reqinfo )
    {
        this._withConnection( as, 'RC', ( as, conn ) =>
        {
            const p = reqinfo.params();
            const args = p.args.map( ( v ) => conn.escape( v ) ).join( ',' );
            const q = `CALL ${conn.escapeId( p.name )}(${args})`;
            this._handleResult( as, conn.query( q ), false,
                ( res ) => reqinfo.result( res ) );
        } );
    }

    getFlavour( as, reqinfo )
    {
        reqinfo.result( 'mysql' );
    }

    xfer( as, reqinfo )
    {
        const p = reqinfo.params();

        this._withConnection( as, p.isol, ( as, conn ) =>
        {
            const ql = p.ql;
            const results = [];

            as.add(
                ( as ) =>
                {
                    // Begin
                    as.add( ( as ) =>
                    {
                        const dbq = conn.beginTransaction();
                        this._handleResult( as, dbq );
                    } );

                    // Loop through query list
                    as.forEach( ql, ( as, stmt_id, xfer ) =>
                    {
                        const dbq = conn.query( xfer.q );
                        this._handleResult( as, dbq, true,
                            ( qresults ) => this._xferCommon(
                                as, xfer, qresults, stmt_id, results )
                        );
                    } );

                    // Commit
                    as.add( ( as ) =>
                    {
                        reqinfo.result( results );
                        const dbq = conn.commit();
                        this._handleResult( as, dbq );
                    } );
                },
                ( as, err ) =>
                {
                    conn.rollback();
                }
            );
        } );
    }
}

module.exports = MySQLService;
