'use strict';

const _driverImpl = new Map();
const _cloneDeep = require( 'lodash/cloneDeep' );
const FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
const COND = '$COND$';
const COND_RE = /^(.+)\s(=|<>|!=|>|>=|<|<=|IN|NOT IN|BETWEEN|NOT BETWEEN|LIKE|NOT LIKE)\s*$/;
const IS_DEBUG = process && process.env.NODE_ENV !== 'production';

/**
 * Basic interface for DB flavour support
 */
class IDriver
{
    constructor()
    {
        this.COND = COND;
    }

    entity( entity )
    {
        void entity;
        throw new Error( 'Not implemented' );
    }

    escape( value, op=undefined )
    {
        void value;
        void op;
        throw new Error( 'Not implemented' );
    }

    expr( expr )
    {
        void expr;
        throw new Error( 'Not implemented' );
    }

    checkField( field )
    {
        if ( !field.match( FIELD_RE ) )
        {
            throw new Error( `Invalid field name: ${field}` );
        }
    }

    build( state )
    {
        void state;
        throw new Error( 'Not implemented' );
    }

    _ensureUsed( state, used )
    {
        for ( let f in state )
        {
            let v = state[f];

            if ( v instanceof Map )
            {
                if ( v.size && !used[f] )
                {
                    throw new Error( `Unused map "${f}"` );
                }
            }
            else if ( v instanceof Array )
            {
                if ( v.length && !used[f] )
                {
                    throw new Error( `Unused array "${f}"` );
                }
            }
            else if ( v && !used[f] )
            {
                throw new Error( `Unused generic "${f}"` );
            }
        }
    }
}

/**
 * Basic logic for SQL-based databases
 */
class SQLDriver extends IDriver
{
    entity( entity )
    {
        if ( typeof entity === 'string' )
        {
            return entity;
        }
        else if ( entity instanceof Array )
        {
            if ( entity.length !== 2 )
            {
                throw new Error(
                    `Entity as array format is [name, alias]: ${entity}`
                );
            }

            let q = entity[0];
            const alias = entity[1];

            if ( q instanceof QueryBuilder )
            {
                q = q._toQuery();
                q = `(${q})`;
            }

            return `${q} AS ${alias}`;
        }
        else
        {
            throw new Error( `Unknown entity type: ${entity}` );
        }
    }

    escape( value, op=undefined )
    {
        if ( value instanceof QueryBuilder )
        {
            const raw_query = value._toQuery();
            return `(${raw_query})`;
        }


        if ( op === 'BETWEEN' || op === 'NOT BETWEEN' )
        {
            if ( value instanceof Array && value.length === 2 )
            {
                const a = this.escape( value[0] );
                const b = this.escape( value[1] );
                return `${a} AND ${b}`;
            }
            else
            {
                throw new Error( `BETWEEN requires array with two elements` );
            }
        }

        if ( value instanceof Array )
        {
            const raw_query = value.map( v => this.escape( v ) ).join( ',' );
            return `(${raw_query})`;
        }

        return this._escapeSimple( value );
    }

    _escapeSimple( value )
    {
        void value;
        throw new Error( 'Not implemented' );

        /*
        switch (typeof value) {
        case 'boolean':
            return value ? 'TRUE' : 'FALSE';
            
        case 'string':
            return implementation_defined.escape(value);
            
        case 'number':
            return `${value}`;
            
        default:
            if (value === null) {
                return 'NULL';
            }

            throw new Error(`Unknown type: ${typeof value}`);
        }
        */
    }

    expr( expr )
    {
        if ( expr instanceof QueryBuilder )
        {
            const raw_query = expr._toQuery();
            return `(${raw_query})`;
        }

        return this._escapeExpr( expr );
    }

    _escapeExpr( expr )
    {
        return expr;
    }

    build( state )
    {
        const type = state.type.toUpperCase();
        const entity = state.entity;
        const q = [];
        const use = {
            type: true,
            entity: true,
            select: false,
            toset: false,
            where: false,
            having: false,
            group: false,
            order: false,
            limit: false,
            joins: false,
        };

        const build_cond = ( c ) =>
        {
            if ( c instanceof Array )
            {
                if ( c[0] === COND )
                {
                    if ( c.length == 2 )
                    {
                        return c[1];
                    }
                    else if ( c.length === 4 )
                    {
                        return `${c[1]} ${c[2]} ${c[3]}`;
                    }
                }
                else
                {
                    const op = c[0];
                    const res = [];
                    const iter = c[Symbol.iterator]();

                    iter.next();

                    for ( let iv = iter.next(); !iv.done; iv = iter.next() )
                    {
                        let v = iv.value;
                        let r = build_cond( v );

                        if ( ( v[0] === 'OR' && v.length > 2 ) ||
                             ( op === 'OR' && v[0] !== COND ) )
                        {
                            r = `(${r})`;
                        }

                        res.push( r );
                    }

                    return res.join( ` ${op} ` );
                }
            }

            throw new Error( `Must not get here: ${c}` );
        };

        const add_common = ( kw, cond ) =>
        {
            if ( cond.length )
            {
                q.push( ` ${kw} ` );
                q.push( build_cond( cond ) );
            }
        };

        const add_where = () =>
        {
            use.where = true;
            add_common( 'WHERE', state.where );
        };

        switch ( type )
        {
        case 'DELETE':
            q.push( `DELETE FROM ${entity}` );
            add_where();
            break;

        case 'INSERT':
            q.push( `INSERT INTO ${entity} (` );
            q.push( state.toset.keys().join( ',' ) );
            q.push( ') VALUES (' );
            q.push( state.toset.values().join( ',' ) );
            q.push( ')' );
            use.toset = true;
            break;

        case 'SELECT': {
            q.push( 'SELECT ' );

            if ( state.select.size )
            {
                q.push( state.select
                    .entries()
                    .map( ( [ f, v ] ) => `${f} AS ${v}` )
                    .join( ',' ) );
                use.select = true;
            }
            else
            {
                q.push( '*' );
            }

            if ( !entity ) break;

            //---
            q.push( ` FROM ${entity}` );

            //---
            for ( let j of state.joins )
            {
                q.push( ` ${j.type} JOIN ${j.entity}` );
                add_common( 'ON', j.cond );
            }

            use.joins = true;

            //---
            add_where();

            //---
            const group = state.group;

            if ( group )
            {
                q.push( ` GROUP BY ${group.joim( ',' )}` );
                use.group = true;
            }

            //---
            use.having = true;
            add_common( 'HAVING', state.having );

            //---
            const order = state.order;

            if ( order )
            {
                q.push( ` ORDER BY ${order.joim( ',' )}` );
                use.order = true;
            }

            //---
            const limit = state.limit;

            if ( limit && this._isLimitOffsetSupport() )
            {
                use.limit = true;
                q.push( ` LIMIT ${limit[0]}` );

                const offset = limit[1];

                if ( offset !== undefined )
                {
                    q.push( ` OFFSET ${offset}` );
                }
            }

            break;
        }

        case 'UPDATE':
            q.push( `UPDATE ${entity} SET ` );
            q.push( state.toset.entries()
                .map( ( f, v ) => `${f}=${v}` )
                .join( ',' ) );
            use.toset = true;
            add_where();
            break;

        default:
            throw new Error( `Unsupported query type ${type}` );
        }

        if ( IS_DEBUG )
        {
            this._ensureUsed( state, use );
        }

        return q.join( '' );
    }

    _isLimitOffsetSupport()
    {
        return true;
    }
}


/**
 * Neutral query builder
 */
class QueryBuilder
{
    /**
    * Base for QB Driver implementation
    */
    static get IDriver()
    {
        return IDriver;
    }

    /**
    * Base for SQL-based QB Driver implementation
    */
    static get SQLDriver()
    {
        return SQLDriver;
    }

    /**
     * @private
     * @param {QueryBuilder|L1Face} qb_or_lface - ref
     * @param {string} db_type - type of driver
     * @param {string} type - type of driver
     * @param {string|null} entity - primary target to operate on
     */
    constructor( qb_or_lface, db_type=null, type=null, entity=null )
    {
        if ( qb_or_lface instanceof QueryBuilder )
        {
            this._lface = qb_or_lface._lface;
            this._db_type = qb_or_lface._db_type;
            this._state = _cloneDeep( qb_or_lface._state );
        }
        else
        {
            this._lface = qb_or_lface;
            this._db_type = db_type;
            this._state = {
                type,
                entity: this.getDriver().entity( entity ),
                select: new Map(),
                toset: new Map(),
                where: [],
                having: [],
                group: [],
                order: [],
                limit: null,
                joins: [],
            };
        }
    }

    /**
     * Register query builder driver implementation
     * @param {string} type - type of driver
     * @param {IDriver|function|string|object} module - implementation
     */
    static addDriver( type, module )
    {
        _driverImpl.set( type, module );
    }

    /**
     * Get implementation of previously registered driver
     * @param {string} type - type of driver
     * @returns {IDriver} actual implementation of query builder driver
     */
    static getDriver( type )
    {
        let impl = _driverImpl.get( type );

        if ( typeof impl === 'undefined' )
        {
            throw new Error( `Unknown DB type: ${type}` );
        }
        else if ( impl instanceof IDriver )
        {
            return impl;
        }
        else if ( typeof impl === 'string' && typeof module !== 'undefined' )
        {
            impl = module.require( impl );
            impl = new impl( type );
        }
        else if ( typeof impl === 'function' )
        {
            impl = impl();
        }
        else
        {
            return new impl;
        }

        _driverImpl[type] = impl;
        return impl;
    }

    /**
     * Get related QB driver
     * @returns {IDriver} actual implementation of query builder driver
     */
    getDriver()
    {
        return this.constructor.getDriver( this._db_type );
    }

    /**
     * Get a copy of Query Builder
     * @returns {QueryBuilder} copy which can be processed independently
     */
    clone()
    {
        return new QueryBuilder( this );
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
     * Set fields to retrieve.
     * 
     * Can be called multiple times for appending.
     * Fields can be a Map or object:
     * - keys are field names as is
     * - values - any expression which is not being escaped automatically
     * 
     * Value can be another QueryBuilder instance.
     * 
     * @param {Map|object} fields - see concept for details
     * @returns {QueryBuilder} self
     */
    get( fields )
    {
        const select = this._state.select;
        const driver = this.getDriver();

        if ( fields instanceof Map )
        {
            for ( let [ f, v ] of fields.entries() )
            {
                driver.checkField( f );
                select.set( f, driver.expr( v ) );
            }
        }
        else if ( typeof fields === 'object' )
        {
            for ( let f in fields )
            {
                driver.checkField( f );
                select.set( f, driver.expr( fields[f] ) );
            }
        }
        else
        {
            throw new Error( `Not supported fields definition: ${fields}` );
        }

        return this;
    }

    /**
     * Add fields to set in UPDATE query.
     * 
     * Field can be Map or object to setup multiple fields at once.
     * - keys - key name as is, no escape
     * - value - any value to be escaped or QueryBuilder instance
     * 
     * @param {Map|object|string} field - field(s) to assign
     * @param {string|number|null|QueryBuilder} value - value to assign
     * @returns {QueryBuilder} self
     */
    set( field, value=undefined )
    {
        const toset = this._state.toset;
        const driver = this.getDriver();

        if ( field instanceof Map )
        {
            for ( let [ f, v ] of field.entries() )
            {
                driver.checkField( f );
                toset.set( f, driver.escape( v ) );
            }
        }
        else if ( typeof field === 'object' )
        {
            for ( let f in field )
            {
                driver.checkField( f );
                toset.set( f, driver.escape( field[f] ) );
            }
        }
        else if ( typeof field === 'string' )
        {
            driver.checkField( field );
            toset.set( field, driver.escape( value ) );
        }
        else
        {
            throw new Error( `Not supported set definition: ${field}` );
        }

        return this;
    }

    /**
     * Control "WHERE" part
     * @param {*} conditions - constraints to add
     * @returns {QueryBuilder} self
     */
    where( conditions )
    {
        this._processConditions( this._state.where, conditions );
        return this;
    }


    /**
     * Control "HAVING" part
     * @param {*} conditions - constraints to add
     * @returns {QueryBuilder} self
     * @see QueryBuilder.where
     */
    having( conditions )
    {
        this._processConditions( this._state.having, conditions );
        return this;
    }

    /**
     * Append group by
     * @param {string} field_expr - field or expressions
     * @returns {QueryBuilder} self
     */
    group( field_expr )
    {
        this._state.group.push( field_expr );
        return this;
    }

    /**
     * Append order by
     * @param {string} field_expr - field or expressions
     * @param {Boolean} [ascending=true] - ascending sorting, if true
     * @returns {QueryBuilder} self
     */
    order( field_expr, ascending=true )
    {
        const order = ascending ? 'ASC' : 'DESC';
        this._state.order.push( [ field_expr, order ] );
        return this;
    }

    /**
     * Limit query output
     *
     * @param {integer} count - size
     * @param {integer} [offset=0] - offset
     * @returns {QueryBuilder} self
     * @note if @p count is omitted then @p start is used as count!
     */
    limit( count, offset = undefined )
    {
        this._state.limit = [ count, offset ];
        return this;
    }

    /**
     * Add "JOIN" part
     * @param {string} type - e.g. INNER, LEFT
     * @param {string|array} entity - fornat is the same as of QueryBuilder
     * @param {*} conditions - constraints to add
     * @returns {QueryBuilder} self
     * @see QueryBuilder.where
     */
    join( type, entity, conditions )
    {
        const joins = this._state.joins;
        const cond = [];

        if ( conditions )
        {
            this._processConditions( cond, conditions );
        }

        entity = this.getDriver().entity( entity );
        joins.push( {
            type,
            entity,
            cond,
        } );
        return this;
    }

    /**
     * Add "INNER JOIN"
     * @param {string|array} entity - fornat is the same as of QueryBuilder
     * @param {*} conditions - constraints to add
     * @returns {QueryBuilder} self
     * @see QueryBuilder.where
     */
    innerJoin( entity, conditions )
    {
        return this.join( 'INNER', entity, conditions );
    }

    /**
     * Add "LEFT JOIN"
     * @param {string|array} entity - fornat is the same as of QueryBuilder
     * @param {*} conditions - constraints to add
     * @returns {QueryBuilder} self
     * @see QueryBuilder.where
     */
    leftJoin( entity, conditions )
    {
        return this.join( 'LEFT', entity, conditions );
    }

    /**
     * Complete query and execute through associated interface.
     * @param {AsyncSteps} as - steps interface
     * @param {Boolean} unsafe_dml - raise error, if DML without conditions
     * @see L1Face.query
     */
    execute( as, unsafe_dml=false )
    {
        if ( !unsafe_dml && !this._state.where.length )
        {
            as.error( 'InternalError', 'Unsafe DML' );
        }

        const q = this._toQuery();
        this._lface.query( as, q );
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
        as.add( ( as, res ) =>
        {
            this._lface.associateResult( as, res );
        } );
    }

    _toQuery()
    {
        return this.getDriver().build( this._state );
    }

    _processConditions( target, conditions )
    {
        if ( !target.length )
        {
            target.push( 'AND' );
        }

        if ( conditions instanceof Array )
        {
            let dst = target;
            const op = conditions[0];
            const iter = conditions[Symbol.iterator]();

            if ( op === 'OR' || op === 'AND' )
            {
                iter.next();

                if ( op !== target[0] )
                {
                    dst = [ op ];
                    target.push( dst );
                }
            }

            for ( let iv = iter.next(); !iv.done; iv = iter.next() )
            {
                this._processConditions( dst, iv.value );
            }
        }
        else if ( typeof conditions === 'string' )
        {
            target.push( [ COND, conditions ] );
        }
        else
        {
            const driver = this.getDriver();
            const confField = ( f, v ) =>
            {
                const m = f.match( COND_RE );
                let op = '=';

                if ( m )
                {
                    f = m[1];
                    op = m[2];
                }

                return [ COND, f, op, driver.escape( v, op ) ];
            };

            if ( conditions instanceof Map )
            {
                for ( let [ f, v ] of conditions.entries() )
                {
                    target.push( confField( f, v ) );
                }
            }
            else if ( typeof conditions === 'object' )
            {
                for ( let f in conditions )
                {
                    target.push( confField( f, conditions[f] ) );
                }
            }
            else
            {
                throw new Error( `Unknown condition type: ${conditions}` );
            }
        }
    }
}

module.exports = QueryBuilder;
