'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const L1Face = require( './L1Face' );
const { FutoInError } = require( 'futoin-asyncsteps' );


/**
 * Base for Level 1 Database service implementation
 */
class L1Service extends PingService
{
    /**
     * Register futoin.db.l1 interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - options to pass to constructor
     * @param {string} options.host - database host
     * @param {string} options.port - database port
     * @param {string} options.database - database name
     * @param {string} options.user - database user
     * @param {string} options.password - database password
     * @param {string} options.conn_limit - max connections
     * @returns {L1Service} instance
     */
    static register( as, executor, options )
    {
        const iface = L1Face.spec( L1Face.LATEST_VERSION );
        const ifacever = iface.iface + ':' + iface.version;
        const impl = new this( options );
        const spec_dirs = [ iface, PingFace.spec( L1Face.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.once( 'close', () => impl._close() );

        return impl;
    }

    get MAX_ROWS()
    {
        return 1000;
    }

    _close()
    {
    }

    query( as, _reqinfo )
    {
        as.error( FutoInError.NotImplemented );
    }

    callStored( as, _reqinfo )
    {
        as.error( FutoInError.NotImplemented );
    }

    getFlavour( as, _reqinfo )
    {
        as.error( FutoInError.NotImplemented );
    }
}

module.exports = L1Service;
