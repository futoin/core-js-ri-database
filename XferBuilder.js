'use strict';

const _cloneDeep = require( 'lodash/cloneDeep' );
const QueryBuilder = require( './QueryBuilder' );

/**
 * @class
 * @name QueryOptions
 * @property {integer|boolean|null} affected - affected rows constaint
 * @property {integer|boolean|null} selected - selected rows constaint
 * @property {boolean|null} return - return result in response
 */

/**
 * Version of QueryBuilder which forbids direct execution.
 */
class XferQueryBuilder extends QueryBuilder
{
    execute( as, unsafe_dml=false )
    {
        void unsafe_dml;
        throw new Error( 'Please use XferBuilder.execute()' );
    }

    clone()
    {
        throw new Error( 'Cloning is not allowed' );
    }
}

/**
 * Transction builder.
 * 
 * Overall concept is build inividual queries to be executed without delay.
 * It's possible to add result constraints to each query for intermediate checks:
 * - affected - integer or boolean to check DML result
 * - selected - integer or boolean to check DQL result
 * - result - mark query result to be returned in response list
 */
class XferBuilder
{
    constructor( xb_or_lface, db_type=null, iso_level=null )
    {
        if ( xb_or_lface instanceof XferBuilder )
        {
            this._lface = xb_or_lface._lface;
            this._db_type = xb_or_lface._db_type;
            this._iso_level = xb_or_lface._iso_level;
            this._query_list = _cloneDeep( xb_or_lface._query_list );
        }
        else
        {
            this._lface = xb_or_lface;
            this._db_type = db_type;
            this._iso_level = iso_level;
            this._query_list = [];
        }
    }

    /**
     * Get a copy of XferBuilder for independent processing.
     * @returns {XferBuilder} transaction builder instance
     */
    clone()
    {
        return new XferBuilder( this );
    }

    /**
     * Get related QV driver
     * @returns {IDriver} actual implementation of query builder driver
     */
    getDriver()
    {
        return QueryBuilder.getDriver( this._db_type );
    }


    /**
     * Escape value for embedding into raw query
     * @param {*} value - value, array or sub-query to escape
     * @returns {string} driver-specific escape
     */
    escape( value )
    {
        return this.getDriver().escape( value );
    }

    /**
     * Escape identifier for embedding into raw query
     * @param {string} name - raw identifier to escape
     * @returns {string} driver-specific escape
     */
    identifier( name )
    {
        return this.getDriver().identifier( name );
    }

    /**
     * Wrap raw expression to prevent escaping.
     * @param {string} expr - expression to wrap
     * @return {Expression} wrapped expression
     */
    expr( expr )
    {
        return new QueryBuilder.Expression( this.getDriver().expr( expr ) );
    }


    /**
     * Wrap parameter name to prevent escaping.
     * @param {string} name - name to wrap
     * @return {Expression} wrapped expression
     */
    param( name )
    {
        return new QueryBuilder.Expression( this.getDriver().expr( `:${name}` ) );
    }

    /**
     * Get generic query builder
     * @param {string} type - query type
     * @param {string|null} entity - man subject
     * @param {QueryOptions} [query_options={}] - constraints
     * @returns {XferQueryBuilder} individual query builder instance
     */
    query( type, entity, query_options={} )
    {
        const qb = this._newBuilder( type, entity );

        for ( let qo in query_options )
        {
            switch( qo )
            {
            case 'affected':
            case 'result':
            case 'selected':
                break;

            default:
                throw new Error( `Invalid query option: ${qo}` );
            }
        }

        const item = _cloneDeep( query_options );
        item.q = qb;

        this._query_list.push( item );
        return qb;
    }

    /**
     * Get DELETE query builder
     * @param {string|null} entity - man subject
     * @param {QueryOptions} [query_options={}] - constraints
     * @returns {XferQueryBuilder} individual query builder instance
     */
    delete( entity, query_options={} )
    {
        return this.query( 'DELETE', entity, query_options );
    }

    /**
     * Get INSERT query builder
     * @param {string|null} entity - man subject
     * @param {QueryOptions} [query_options={}] - constraints
     * @returns {XferQueryBuilder} individual query builder instance
     */
    insert( entity, query_options={} )
    {
        return this.query( 'INSERT', entity, query_options );
    }

    /**
     * Get UPDATE query builder
     * @param {string|null} entity - man subject
     * @param {QueryOptions} [query_options={}] - constraints
     * @returns {XferQueryBuilder} individual query builder instance
     */
    update( entity, query_options={} )
    {
        return this.query( 'UPDATE', entity, query_options );
    }

    /**
     * Get SELECT query builder
     * @param {string|null} entity - man subject
     * @param {QueryOptions} [query_options={}] - constraints
     * @returns {XferQueryBuilder} individual query builder instance
     */
    select( entity, query_options={} )
    {
        return this.query( 'SELECT', entity, query_options );
    }

    /**
     * Add CALL query
     * @param {string} name - stored procedure name
     * @param {array} [args=[]] - positional arguments
     * @param {QueryOptions} [query_options={}] - constraints
     */
    call( name, args=[], query_options={} )
    {
        const qb = this._newBuilder( 'CALL', name );
        qb._callParams( args );

        const item = _cloneDeep( query_options );
        item.q = qb._toQuery();

        this._query_list.push( item );
    }

    /**
     * Execute raw query
     * @param {string} q - raw query
     * @param {object} [params=null] - named argument=>value pairs
     * @param {QueryOptions} [query_options={}] - constraints
     * @note Pass null in {@p params}, if you want to use prepare()
     */
    raw( q, params=null, query_options={} )
    {
        const item = _cloneDeep( query_options );

        if ( params )
        {
            const driver = this.getDriver();
            item.q = QueryBuilder._replaceParams( driver, q, params );
        }
        else
        {
            item.q = q;
        }

        this._query_list.push( item );
    }

    /**
     * Complete query and execute through associated interface.
     * @param {AsyncSteps} as - steps interface
     * @param {Boolean} unsafe_dml - raise error, if DML without conditions
     * @see L1Face.query
     */
    execute( as, unsafe_dml=false )
    {
        const ql = this._query_list;
        this._prepareQueryList( ql, unsafe_dml );
        this._lface.xfer( as, ql, this._iso_level );
    }

    /**
     * Complete query and execute through associated interface.
     * @param {AsyncSteps} as - steps interface
     * @param {Boolean} unsafe_dml - raise error, if DML without conditions
     * @see L1Face.query
     * @see L1Face.associateResult
     */
    executeAssoc( as, unsafe_dml=false )
    {
        this.execute( as, unsafe_dml );
        as.add( this.constructor._assocResult( this._lface ) );
    }


    /**
     * Prepare statement for efficient execution multiple times
     * @param {Boolean} unsafe_dml - raise error, if DML without conditions
     * @returns {ExecPrepared} closue with prepared statement
     */
    prepare( unsafe_dml=false )
    {
        const ql = _cloneDeep( this._query_list );
        const isol = this._iso_level;
        const db_type = this._db_type;
        this._prepareQueryList( ql, unsafe_dml );

        return new class extends QueryBuilder.Prepared
        {
            execute( as, iface, params=null )
            {
                if ( params )
                {
                    const driver = QueryBuilder.getDriver( db_type );
                    const pql = _cloneDeep( ql );

                    pql.forEach( ( v ) =>
                    {
                        v.q = QueryBuilder._replaceParams( driver, v.q, params );
                    } );

                    iface.xfer( as, pql, isol );
                }
                else
                {
                    iface.xfer( as, ql, isol );
                }
            }

            executeAssoc( as, iface, params )
            {
                this.execute( as, iface, params );
                as.add( XferBuilder._assocResult( iface ) );
            }
        };
    }


    _newBuilder( type, entity=null )
    {
        return new XferQueryBuilder(
            this._lface,
            this._db_type,
            type,
            entity
        );
    }

    _prepareQueryList( ql, unsafe_dml )
    {
        ql.forEach( ( v ) =>
        {
            const qb = v.q;

            if ( qb instanceof XferQueryBuilder )
            {
                v.q = qb._toQuery( unsafe_dml );
                // damage on purpose
                qb._state = null;
            }
        } );
    }

    static _assocResult( iface )
    {
        return function( as, res )
        {
            const assoc_res = res.map( ( v ) =>
            {
                const rows = iface.associateResult( v );
                return {
                    rows,
                    affected: v.affected,
                };
            } );

            as.success( assoc_res );
        };
    }
}

module.exports = XferBuilder;
