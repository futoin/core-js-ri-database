'use strict';

const L1Service = require( './L1Service' );
const PingFace = require( 'futoin-invoker/PingFace' );
const L1Face = require( './L1Face' );
const L2Face = require( './L2Face' );
const { FutoInError } = require( 'futoin-asyncsteps' );

/**
 * Base for Level 2 Database service implementation
 */
class L2Service extends L1Service
{
    /**
     * Register futoin.db.l2 interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     */
    static register( as, executor )
    {
        const iface = L2Face.spec( L1Face.LATEST_VERSION );
        const ifacever = iface.iface + ':' + iface.version;
        const impl = new this();
        const spec_dirs = [ iface, L1Face.spec( L1Face.LATEST_VERSION ), PingFace.spec( L1Face.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
    }

    xfer( as, reqinfo )
    {
        as.error( FutoInError.NotImplemented );
        void reqinfo;
    }
}

module.exports = L2Service;
