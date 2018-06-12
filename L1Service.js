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

const PingService = require( 'futoin-executor/PingService' );
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
        const ifacever = `${L1Face.IFACE_NAME}:${L1Face.LATEST_VERSION}`;
        const impl = new this( options );
        const spec_dirs = L1Face.spec();

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
