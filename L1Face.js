'use strict';

const PingFace = require( 'futoin-invoker/PingFace' );
const QueryBuilder = require ( './QueryBuilder' );

/**
 * Level 1 Database Face
 */
class L1Face extends PingFace
{
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
    static register( as, ccm, name, endpoint, credentials=null, options={} )
    {
        const ifacever = options.version || '1.0';
        const iface = this.spec( ifacever );

        options.nativeImpl = this;
        options.specDirs = [ iface, PingFace.spec( '1.0' ) ];

        ccm.register(
            as,
            name,
            iface.iface + ':' + ifacever,
            endpoint,
            credentials,
            options
        );

        as.add( ( as ) =>
        {
            this.getFlavour( as );
        } );
    }

    /**
     * Get type of database
     * 
     * @param {AsyncSteps} as - steps interface
     */
    getFlavour( as )
    {
        let db_type = this._db_type;

        if ( !db_type )
        {
            this.call( as, 'getFlavour' );
            as.add( ( as, res ) =>
            {
                let db_type = res.flavour;
                this._db_type = db_type;
                as.success( db_type );
            } );
        }
        else
        {
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
    queryBuilder( type, entity )
    {
        return new QueryBuilder( this, this._db_type, type, entity );
    }

    /**
     * Get neutral query builder for DELETE
     * @param {string} entity - table/view/etc. name
     * @returns {QueryBuilder} associated instance
     */
    delete( entity )
    {
        return this.queryBuilder( 'DELETE', entity );
    }

    /**
     * Get neutral query builder for INSERT
     * @param {string} entity - table/view/etc. name
     * @returns {QueryBuilder} associated instance
     */
    insert( entity )
    {
        return this.queryBuilder( 'INSERT', entity );
    }

    /**
     * Get neutral query builder for SELECT
     * @param {string} entity - table/view/etc. name
     * @returns {QueryBuilder} associated instance
     */
    select( entity )
    {
        return this.queryBuilder( 'SELECT', entity );
    }

    /**
     * Get neutral query builder for UPDATE
     * @param {string} entity - table/view/etc. name
     * @returns {QueryBuilder} associated instance
     */
    update( entity )
    {
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
    paramQuery( as, q, params={} )
    {
        const qb = new QueryBuilder( this );

        for ( let p in params )
        {
            q = q.replace( ':'+p, qb.escape( params[p] ) );
        }

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
    associateResult( as_result )
    {
        const res = [];
        const fields = as_result.fields;

        for ( let r of as_result.rows )
        {
            let ar = new Map();

            for ( let i = 0, c = r.length;
                i < c; ++i )
            {
                ar.set( fields[i], r[i] );
            }

            res.push( ar );
        }

        return res;
    }
}

module.exports = L1Face;

const specs = {};
L1Face._specs = specs;

specs['1.0'] = {
    iface : "futoin.db.l1",
    version : "1.0",
    ftn3rev : "1.6",
    imports : [ "futoin.ping:1.0" ],
    types : {
        Query : {
            type : "string",
            minlen : 1,
            maxlen : 10000,
        },
        Identifier : {
            type : "string",
            maxlen : 256,
        },
        Row : "array",
        Rows : {
            type : "array",
            elemtype : "Row",
            maxlen : 1000,
        },
        Field : {
            type : "string",
            maxlen : 256,
        },
        Fields : {
            type : "array",
            elemtype : "Field",
            desc : "List of field named in order of related Row",
        },
        Flavour : {
            type : "Identifier",
            desc : "Actual actual database driver type",
        },
    },
    funcs : {
        query : {
            params : { q : "Query" },
            result : {
                rows : "Rows",
                fields : "Fields",
                affected : "integer",
            },
            throws : [ "InvalidQuery", "Duplicate", "OtherExecError", "LimitTooHigh" ],
        },
        callStored : {
            params : {
                name : "Identifier",
                args : "Row",
            },
            result : {
                rows : "Rows",
                fields : "Fields",
                affected : "integer",
            },
            throws : [ "InvalidQuery", "Duplicate", "OtherExecError", "LimitTooHigh" ],
        },
        getFlavour : { result : { flavour : "Flavour" } },
    },
};
