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

const L1Service = require( './L1Service' );
const L2Face = require( './L2Face' );
const { FutoInError } = require( 'futoin-asyncsteps' );

/**
 * Base for Level 2 Database service implementation
 */
class L2Service extends L1Service {
    /**
     * Register futoin.db.l2 interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - options to pass to constructor
     * @param {string} options.host - database host
     * @param {string} options.port - database port
     * @param {string} options.database - database name
     * @param {string} options.user - database user
     * @param {string} options.password - database password
     * @param {string} options.conn_limit - max connections
     * @returns {L2Service} instance
     */
    static register( as, executor, options ) {
        const ifacever = `${L2Face.IFACE_NAME}:${L2Face.LATEST_VERSION}`;
        const impl = new this( options );
        const spec_dirs = L2Face.spec();

        executor.register( as, ifacever, impl, spec_dirs );
        executor.once( 'close', () => impl._close() );

        return impl;
    }

    constructor( driver ) {
        super();
        this._driver = driver || null;
        this._helpers = driver ? driver.helpers : null;
    }

    xfer( as, _reqinfo ) {
        as.error( FutoInError.NotImplemented );
    }

    _xferCommon( as, xfer, qresults, stmt_id, results, q ) {
        const res = qresults[0];
        let fail_on_multi = false;
        let cond_error = null;

        // Affected checks
        //---
        if ( typeof xfer.affected === 'boolean' ) {
            fail_on_multi = true;

            if ( ( xfer.affected && ( res.affected <= 0 ) ) ||
                 ( !xfer.affected && ( res.affected > 0 ) ) ) {
                cond_error = `Affected ${stmt_id}: ${res.affected} (${q})`;
            }
        } else if ( typeof xfer.affected === 'number' ) {
            fail_on_multi = true;

            if ( res.affected !== xfer.affected ) {
                cond_error = `Affected ${stmt_id}: ${res.affected} != ${xfer.affected} (${q})`;
            }
        }

        // Selected checks
        //---
        if ( typeof xfer.selected === 'boolean' ) {
            fail_on_multi = true;

            if ( ( xfer.selected && ( res.rows.length <= 0 ) ) ||
                 ( !xfer.selected && ( res.rows.length > 0 ) ) ) {
                cond_error = `Selected ${stmt_id}: ${res.rows.length} (${q})`;
            }
        } else if ( typeof xfer.selected === 'number' ) {
            fail_on_multi = true;

            if ( res.rows.length !== xfer.selected ) {
                cond_error = `Selected ${res.rows.length} != ${xfer.selected} (${q})`;
            }
        }

        if ( cond_error ) {
            as.error( 'XferCondition', cond_error );
        }

        // Sanity check
        if ( fail_on_multi && qresults.length !== 1 ) {
            as.error( 'XferCondition',
                'Multiple results for conditions' );
        }

        // Return result
        if ( xfer.result ) {
            qresults.forEach( ( v ) => {
                v.seq = stmt_id;
                results.push( v );
            } );
        }
    }

    get _xferTemplatePattern() {
        return /\$'([0-9]+):([$A-Za-z_]+):(s|m)'\$/g;
    }

    _xferTemplate( as, xfer, prev_results ) {
        if ( !xfer.template ) {
            return xfer.q;
        }

        return xfer.q.replace(
            this._xferTemplatePattern,
            ( _m, query_id, field, mode ) => {
                if ( query_id >= prev_results.length ) {
                    as.error( 'XferBackRef',
                        `Invalid template query ID: ${query_id}` );
                }

                const qres = prev_results[query_id];

                if ( !qres.rows.length ) {
                    as.error( 'XferBackRef',
                        `Empty query result for #${query_id}` );
                }

                const field_id = qres.fields.indexOf( field );

                if ( field_id < 0 ) {
                    as.error( 'XferBackRef',
                        `Invalid template field "${field}" for #${query_id}` );
                }

                if ( mode === 's' ) {
                    if ( qres.rows.length > 1 ) {
                        as.error( 'XferBackRef',
                            `More than one row in result #${query_id}` );
                    }

                    return this._helpers.escape( qres.rows[0][field_id] );
                } else {
                    return this._helpers.escape( qres.rows.map( v => v[field_id] ) );
                }
            }
        );
    }
}

module.exports = L2Service;
