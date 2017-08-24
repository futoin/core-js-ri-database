'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const L1Face = require( './L1Face' );
const { FutoInError } = require( 'futoin-asyncsteps' );

/**
 * Service options object
 * @class
 */
const ServiceOptions =
{
    /**
     * Host to connect to
     */
    host : null,

    /**
     * Port to use on host
     */
    port : null,

    /**
     * Database
     */
    database : null,

    /**
     * Username
     */
    user : null,

    /**
     * Password
     */
    password : null,

    /**
     * Connection limit
     * @default
     */
    conn_limit : 1,
};

void ServiceOptions;

/**
 * Base for Level 1 Database service implementation
 */
class L1Service extends PingService
{
    /**
     * Register futoin.db.l1 interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {ServiceOptions} options - options to pass to constructor
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
