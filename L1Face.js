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

const path = require( 'path' );

const PingFace = require( 'futoin-invoker/PingFace' );
const QueryBuilder = require ( './QueryBuilder' );

/**
 * Level 1 Database Face
 */
class L1Face extends PingFace {
    constructor( ...args ) {
        super( ...args );
        this._db_type = null;
    }

    /**
     * Latest supported FTN17 version
     */
    static get LATEST_VERSION() {
        return '1.0';
    }

    /**
     * Latest supported FTN4 version
     */
    static get PING_VERSION() {
        return '1.0';
    }

    static get IFACE_NAME() {
        return 'futoin.db.l1';
    }

    /**
     * CCM registration helper
     *
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=1.0] - interface version to use
     */
    static register( as, ccm, name, endpoint, credentials=null, options={} ) {
        const ifacever = options.version || this.LATEST_VERSION;

        options.nativeImpl = this;
        options.specDirs = this.spec();
        options.sendOnBehalfOf = options.sendOnBehalfOf || false;

        ccm.register(
            as,
            name,
            `${this.IFACE_NAME}:${ifacever}`,
            endpoint,
            credentials,
            options
        );

        as.add( ( as ) => {
            ccm.iface( name ).getFlavour( as );
        } );
    }

    /**
     * Get type of database
     *
     * @param {AsyncSteps} as - steps interface
     */
    getFlavour( as ) {
        const db_type = this._db_type;

        if ( !db_type ) {
            this.call( as, 'getFlavour' );
            as.add( ( as, res ) => {
                this._db_type = res;
                as.success( res );
            } );
        } else {
            as.success( db_type );
        }
    }

    /**
     * Get neutral query builder object.
     *
     * @param {string} type - Type of query: SELECT, INSERT, UPDATE, DELETE, ...
     * @param {string} entity - table/view/etc. name
     * @returns {QueryBuilder} associated instance
     */
    queryBuilder( type=null, entity=null ) {
        return new QueryBuilder( this, this._db_type, type, entity );
    }

    /**
     * Get query builder helpers
     *
     * Helps avoiding temporary variables for cleaner code.
     * @returns {Helpers} for specific type
     */
    helpers() {
        return QueryBuilder.getDriver( this._db_type ).helpers;
    }

    /**
     * Get neutral query builder for DELETE
     * @param {string} entity - table/view/etc. name
     * @returns {QueryBuilder} associated instance
     */
    delete( entity ) {
        return this.queryBuilder( 'DELETE', entity );
    }

    /**
     * Get neutral query builder for INSERT
     * @param {string} entity - table/view/etc. name
     * @returns {QueryBuilder} associated instance
     */
    insert( entity ) {
        return this.queryBuilder( 'INSERT', entity );
    }

    /**
     * Get neutral query builder for SELECT
     * @param {string} entity - table/view/etc. name
     * @returns {QueryBuilder} associated instance
     */
    select( entity=null ) {
        return this.queryBuilder( 'SELECT', entity );
    }

    /**
     * Get neutral query builder for UPDATE
     * @param {string} entity - table/view/etc. name
     * @returns {QueryBuilder} associated instance
     */
    update( entity ) {
        return this.queryBuilder( 'UPDATE', entity );
    }

    /**
     * @name L1Face#query
     * @param {AsyncSteps} as - steps interface
     * @param {string} q - raw query
     * @note AS result has "rows", "fields" and "affected" members
     */

    /**
     * Execute raw parametrized query
     * @param {AsyncSteps} as - steps interface
     * @param {string} q - raw query with placeholders
     * @param {object} params - named parameters for replacement
     * @note Placeholders must be in form ":name"
     * @note see query() for results
     */
    paramQuery( as, q, params={} ) {
        const helpers = QueryBuilder.getDriver( this._db_type ).helpers;
        q = QueryBuilder._replaceParams( helpers, q, params );
        this.query( as, q );
    }


    /**
     * @name L1Face#callStored
     * @param {AsyncSteps} as - steps interface
     * @param {string} name - stored procedure name
     * @param {array} args - positional arguments to pass
     * @note see query() for results
     */

    /**
     * Convert raw result into array of associated rows (Maps)
     * @param {object} as_result - $as result of query() call
     * @returns {array} Array of maps.
     * @note original result has "rows" as array of arrays and "fields" map
     */
    associateResult( as_result ) {
        const res = [];

        const fields = as_result.fields;

        if ( fields ) {
            for ( let r of as_result.rows ) {
                let ar = {};

                for ( let i = 0, c = r.length;
                    i < c; ++i ) {
                    ar[fields[i]] = r[i];
                }

                res.push( ar );
            }
        }

        return res;
    }

    /**
     * A handy way to store prepared objects and created on demand
     * @param {Symbol} sym - unique symbol per prepared statement
     * @param {callable} cb - a callback returning a prepared statement
     * @returns {Prepared} - associated prepared statement
     */
    getPrepared( sym, cb ) {
        let cache = this._prep_cache;

        if ( !cache ) {
            cache = new Map;
            this._prep_cache = cache;
        }

        let res = cache.get( sym );

        if ( res === undefined ) {
            res = cb( this );
            cache.set( sym, res );
        }

        return res;
    }

    static spec() {
        return [
            path.resolve( __dirname, 'specs' ),
            PingFace.spec( this.PING_VERSION ),
        ];
    }
}

module.exports = L1Face;

