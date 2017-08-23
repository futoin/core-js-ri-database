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
        const spec_dirs = [
            iface,
            L1Face.spec( L1Face.LATEST_VERSION ),
            PingFace.spec( L1Face.PING_VERSION ),
        ];

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
        let cond_error = null;

        // Affected checks
        //---
        if ( typeof xfer.affected === 'boolean' )
        {
            fail_on_multi = true;

            if ( ( xfer.affected && ( res.affected <= 0 ) ) ||
                 ( !xfer.affected && ( res.affected > 0 ) ) )
            {
                cond_error = `Affected ${stmt_id}: ${res.affected}`;
            }
        }
        else if ( typeof xfer.affected === 'number' )
        {
            fail_on_multi = true;

            if ( res.affected !== xfer.affected )
            {
                cond_error = `Affected ${stmt_id}: ${res.affected} != ${xfer.affected}`;
            }
        }

        // Selected checks
        //---
        if ( typeof xfer.selected === 'boolean' )
        {
            fail_on_multi = true;

            if ( ( xfer.selected && ( res.rows.length <= 0 ) ) ||
                 ( !xfer.selected && ( res.rows.length > 0 ) ) )
            {
                cond_error = `Selected ${stmt_id}: ${res.rows.length}`;
            }
        }
        else if ( typeof xfer.selected === 'number' )
        {
            fail_on_multi = true;

            if ( res.rows.length !== xfer.selected )
            {
                cond_error = `Selected ${res.rows.length} != ${xfer.selected}`;
            }
        }

        if ( cond_error )
        {
            as.error( 'XferCondition', cond_error );
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

    get _xferTemplatePattern()
    {
        return /^\$'([0-9]+):([$a-z_]+):(s|m)'\$$/;
    }

    _xferTemplate( as, xfer, prev_results )
    {
        if ( !xfer.template )
        {
            return xfer.q;
        }

        return xfer.q.replace(
            this._xferTemplatePattern,
            ( m, query_id, field, mode ) =>
            {
                void m;

                if ( query_id >= prev_results.length )
                {
                    as.result( 'OtherExecError',
                        `Invalid template query ID: ${query_id}` );
                }

                const qres = prev_results[query_id];

                if ( !qres.rows.length )
                {
                    as.result( 'OtherExecError',
                        `Empty query result for #${query_id}` );
                }

                const field_id = qres.fields.indexOf( field );

                if ( field_id < 0 )
                {
                    as.result( 'OtherExecError',
                        `Invalid template field: ${field}` );
                }

                if ( mode === 's' )
                {
                    return this._driver.escape( qres.rows[0][field_id] );
                }
                else
                {
                    return this._driver.escape( qres.rows.map( v => v[field_id] ) );
                }
            }
        );
    }
}

module.exports = L2Service;
