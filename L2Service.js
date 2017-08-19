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
     * @param {ServiceOptions} options - options to pass to constructor
     * @returns {L2Service} instance
     */
    static register( as, executor, options )
    {
        const iface = L2Face.spec( L1Face.LATEST_VERSION );
        const ifacever = iface.iface + ':' + iface.version;
        const impl = new this( options );
        const spec_dirs = [ iface, L1Face.spec( L1Face.LATEST_VERSION ), PingFace.spec( L1Face.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.once( 'close', () => impl._close() );

        return impl;
    }

    xfer( as, reqinfo )
    {
        as.error( FutoInError.NotImplemented );
        void reqinfo;
    }

    _xferCommon( as, xfer, qresults, stmt_id, results )
    {
        const res = qresults[0];
        let fail_on_multi = false;

        // Affected checks
        //---
        if ( typeof xfer.affected === 'boolean' )
        {
            fail_on_multi = true;

            if ( xfer.affected )
            {
                if ( res.affected <= 0 )
                {
                    as.error( 'XferCondition', 'Affected' );
                }
            }
            else
            {
                if ( res.affected > 0 )
                {
                    as.error( 'XferCondition', 'Affected' );
                }
            }
        }
        else if ( typeof xfer.affected === 'number' )
        {
            fail_on_multi = true;

            if ( res.affected !== xfer.affected )
            {
                as.error( 'XferCondition', 'Affected' );
            }
        }

        // Selected checks
        //---
        if ( typeof xfer.selected === 'boolean' )
        {
            fail_on_multi = true;

            if ( xfer.selected )
            {
                if ( res.rows.length <= 0 )
                {
                    as.error( 'XferCondition', 'Selected' );
                }
            }
            else
            {
                if ( res.rows.length > 0 )
                {
                    as.error( 'XferCondition', 'Selected' );
                }
            }
        }
        else if ( typeof xfer.selected === 'number' )
        {
            fail_on_multi = true;

            if ( res.rows.length !== xfer.selected )
            {
                as.error( 'XferCondition', 'Selected' );
            }
        }

        // Sanity check
        if ( fail_on_multi && qresults.length !== 1 )
        {
            as.error( 'OtherExecError',
                'Multiple results for conditions' );
        }

        // Return result
        if ( xfer.result )
        {
            qresults.forEach( ( v ) =>
            {
                v.seq = stmt_id;
                results.push( v );
            } );
        }
    }
}

module.exports = L2Service;
