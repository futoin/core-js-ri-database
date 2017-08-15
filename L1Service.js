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
     */
    static register( as, executor )
    {
        const iface = L1Face.spec( L1Face.LATEST_VERSION );
        const ifacever = iface.iface + ':' + iface.version;
        const impl = new this();
        const spec_dirs = [ iface, PingFace.spec( L1Face.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
    }

    query( as, reqinfo )
    {
        as.error( FutoInError.NotImplemented );
        void reqinfo;
    }

    callStored( as, reqinfo )
    {
        as.error( FutoInError.NotImplemented );
        void reqinfo;
    }

    getFlavour( as, reqinfo )
    {
        as.error( FutoInError.NotImplemented );
        void reqinfo;
    }
}

module.exports = L1Service;
