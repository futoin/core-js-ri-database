'use strict';

const _driverImpl = new Map();
const _cloneDeep = require( 'lodash/cloneDeep' );
const FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*|\.\*)?$/;
const COND = '$COND$';
const COND_RE = /^(.+)\s(=|<>|!=|>|>=|<|<=|IN|NOT IN|BETWEEN|NOT BETWEEN|LIKE|NOT LIKE)\s*$/;
const IS_DEBUG = process && process.env.NODE_ENV !== 'production';

/**
 * Wrapper for raw expression to prevent escaping
 */
class Expression
{
    constructor( expr )
    {
        this._expr = expr;
    }

    toQuery()
    {
        return this._expr;
    }

    /**
     * Allows easy joining with raw query
     * @returns {string} as is
     */
    toString()
    {
        return this._expr;
    }
}

/**
 * Interface for prepared statement execution
 */
class Prepared
{
    /**
     * @func
     * @name Prepared#execute
     * @param {AsyncSteps} as - step interface
     * @param {object} [params=null] - parameters to subsitute
     */

    /**
     * @func
     * @name Prepared#executeAsync
     * @param {AsyncSteps} as - step interface
     * @param {object} [params=null] - parameters to subsitute
     */
}

/**
 * Additional helpers interface
 */
class Helpers
{
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

    identifier( name )
    {
        void name;
        throw new Error( 'Not implemented' );
    }

    expr( expr )
    {
        void expr;
        throw new Error( 'Not implemented' );
    }

    /**
     * Get DB-specific current timestamp expression
     * @func
     * @name now
     * @returns {Expression} - current timestamp
     */

    /**
     * Convert native timestamp to DB format
     * @func
     * @name date
     * @param {moment|string} value - native timestamp
     * @returns {Expression} - timestamp in DB format
     */

    /**
     * Convert DB timestamp to native format
     * @func
     * @name nativeDate
     * @param {string} value - timestamp in DB format
     * @returns {moment} - timestamp in moment.js
     */

    /**
     * Create expression representing date modification of
     * input expression by specified number of seconds.
     * @func
     * @name dateModify
     * @param {Expression|string} expr - source expression (e.g field name)
     * @param {seconds} seconds - number of seconds to add/subtract(negative)
     * @returns {Expression} - DB expression
     */

    /**
     * Concat arguments. Useful for in-query operation with unknown values.
     * @func
     * @name concat
     * @param {string|Expression} value... - String to escape or Expresion object
     * @returns {Expression} - concatenated argument expression
     */

    /**
     * Cast expression to type
     * @func
     * @name cast
     * @param {string|Expression} value - String to escape or Expresion object
     * @param {type} type - target type
     * @returns {Expression} - cast expression
     * @note implementation by implicitly substitute not supported types with acceptable
     *  equiavelnt like JSON->TEXT/
     */

    /**
     * Add arguments in query.
     * @func
     * @name add
     * @param {string|Expression} a... - arguments
     * @returns {Expression} - addition expression
     */

    /**
     * Subtract arguments in query.
     * @func
     * @name sub
     * @param {string|Expression} a - first arg
     * @param {string|Expression} b - second arg
     * @returns {Expression} - subtraction expression
     */

    /**
     * Multiply arguments in query.
     * @func
     * @name mul
     * @param {string|Expression} a... - arguments
     * @returns {Expression} - multiplication expression
     */

    /**
     * Divide arguments in query.
     * @func
     * @name div
     * @param {string|Expression} a - first arg
     * @param {string|Expression} b - second arg
     * @returns {Expression} - division expression
     */

    /**
     * Reminder of division in query.
     * @func
     * @name rem
     * @param {string|Expression} a - first arg
     * @param {string|Expression} b - second arg
     * @returns {Expression} - reminder expression
     */
}

/**
 * Basic interface for DB flavour support
 * @private
 */
class IDriver
{
    get helpers()
    {
        return this._helpers;
    }

    constructor( helpers )
    {
        this.COND = COND;
        this._helpers = helpers || new Helpers();
    }


    backref( query_id, field, multi )
    {
        void query_id;
        void field;
        void multi;
        throw new Error( 'Not implemented' );
    }

    checkField( field )
    {
        if ( typeof field !== 'string' || !field.match( FIELD_RE ) )
        {
            throw new Error( `Invalid field name: ${field}` );
        }
    }

    build( _state )
    {
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
 * Basic logic for SQL-based helpers
 */
class SQLHelpers extends Helpers
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
                if ( q._state.type !== 'SELECT' )
                {
                    throw new Error( 'Not a SELECT sub-query' );
                }

                q = q._toQuery();
                q = `(${q})`;
            }

            return `${q} AS ${alias}`;
        }
        else if ( entity === null )
        {
            return null;
        }
        else if ( entity instanceof QueryBuilder )
        {
            throw new Error(
                `Entity as sub-query format is [QB, alias]: ${entity}`
            );
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

    _escapeSimple( _value )
    {
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

            if (value instanceof QueryBuilder.Expression)
            {
                return value.toQuery();
            }

            throw new Error(`Unknown type: ${typeof value}`);
        }
        */
    }

    expr( expr )
    {
        return new Expression( this._expr( expr ) );
    }

    _expr( expr )
    {
        if ( expr instanceof QueryBuilder )
        {
            const raw_query = expr._toQuery();
            return `(${raw_query})`;
        }

        if ( expr instanceof Expression )
        {
            return expr.toString();
        }

        if ( typeof expr !== 'string' )
        {
            throw new Error( 'Expression must be QueryBuilder, Expression or string' );
        }

        return this._escapeExpr( expr );
    }

    _escapeExpr( expr )
    {
        return expr;
    }

    concat( ...args )
    {
        const escaped = args.map( ( v ) => this.escape( v ) );
        return new Expression(
            this.expr( `(${escaped.join( '||' )})` )
        );
    }

    cast( a, type )
    {
        const expr = this.escape( a );
        return new Expression( `CAST(${expr} AS ${type})` );
    }

    add( ...args )
    {
        const escaped = args.map( ( v ) => this.escape( v ) );
        return new Expression( `(${escaped.join( '+' )})` );
    }

    sub( a, b )
    {
        a = this.escape( a );
        b = this.escape( b );
        return new Expression( `(${a}-${b})` );
    }

    mul( ...args )
    {
        const escaped = args.map( ( v ) => this.escape( v ) );
        return new Expression( `(${escaped.join( '*' )})` );
    }

    div( a, b )
    {
        a = this.escape( a );
        b = this.escape( b );
        return new Expression( `(${a}/${b})` );
    }

    mod( a, b )
    {
        a = this.escape( a );
        b = this.escape( b );
        return new Expression( `(${a}%${b})` );
    }
}

/**
 * Basic logic for SQL-based databases
 * @private
 */
class SQLDriver extends IDriver
{
    constructor( helpers )
    {
        super( helpers || new SQLHelpers() );
    }

    backref( query_id, field, multi )
    {
        if ( field !== '$id' ) this.checkField( field );

        multi = multi === true ? 'm' : 's';
        return new Expression( `$'${query_id}:${field}:${multi}'$` );
    }

    build( state )
    {
        const type = state.type;
        const entity = state.entity;
        const q = [];
        const use = {
            type: true,
            entity: true,
            select: false,
            toset: false,
            multiset: false,
            where: false,
            having: false,
            group: false,
            order: false,
            limit: false,
            joins: false,
            params: false,
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

        const add_cond = ( kw, cond ) =>
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
            add_cond( 'WHERE', state.where );
        };

        const require_entity = () =>
        {
            if ( !entity )
            {
                throw new Error( 'Entity is not set' );
            }
        };

        const require_toset = () =>
        {
            if ( !state.toset.size )
            {
                throw new Error( 'Nothing to set' );
            }

            use.toset = true;
        };

        switch ( type )
        {
        case 'DELETE':
            require_entity();
            q.push( `DELETE FROM ${entity}` );
            add_where();
            break;

        case 'INSERT': {
            const toset = state.toset;
            require_entity();
            q.push( `INSERT INTO ${entity} ` );

            if ( toset instanceof Array )
            {
                use.toset = true;
                const fields = toset[0];

                if ( fields.length )
                {
                    q.push( `(${fields.join( ',' )}) ` );
                }

                q.push( toset[1] );
            }
            else if ( state.multiset )
            {
                const multiset = state.multiset;
                use.multiset = true;
                use.toset = true;

                // NOTE: side effect
                if ( state.toset.size )
                {
                    multiset.push( state.toset );
                    state.toset = new Map();
                }

                const first = multiset[0];
                const first_keys = Array.from( first.keys() );
                q.push( '(' );
                q.push( first_keys.join( ',' ) );
                q.push( ') VALUES (' );
                q.push( Array.from( first.values() ).join( ',' ) );
                q.push( ')' );

                const row_count = multiset.length;

                for ( let i = 1; i < row_count; ++i )
                {
                    const row = multiset[i];

                    if ( row.size != first.size )
                    {
                        throw new Error( 'Multi-row field count mismatch' );
                    }

                    const vals = first_keys.map( f =>
                    {
                        const v = row.get( f );

                        if ( v === undefined )
                        {
                            throw new Error( `Multi-row missing field: ${f}` );
                        }

                        return v;
                    } );

                    q.push( ',(' + vals.join( ',' ) + ')' );
                }
            }
            else
            {
                require_toset();
                q.push( '(' );
                q.push( Array.from( toset.keys() ).join( ',' ) );
                q.push( ') VALUES (' );
                q.push( Array.from( toset.values() ).join( ',' ) );
                q.push( ')' );
            }

            break;
        }

        case 'SELECT': {
            q.push( 'SELECT ' );

            if ( state.select.size )
            {
                q.push( this._build_select_part( state.select ) );
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
                add_cond( 'ON', j.cond );
            }

            use.joins = true;

            //---
            add_where();

            //---
            const group = state.group;

            if ( group.length )
            {
                q.push( ` GROUP BY ${group.join( ',' )}` );
                use.group = true;
            }

            //---
            use.having = true;
            add_cond( 'HAVING', state.having );

            //---
            const order = state.order;

            if ( order.length )
            {
                const order_parts = order.map( ( v ) => `${v[0]} ${v[1]}` );
                q.push( ` ORDER BY ${order_parts.join( ',' )}` );
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

        case 'UPDATE': {
            require_entity();
            require_toset();
            q.push( `UPDATE ${entity} SET ` );
            const fields = [];

            for ( let [ f, v ] of state.toset.entries() )
            {
                fields.push( `${f}=${v}` );
            }

            q.push( fields.join( ',' ) );
            use.toset = true;
            add_where();
            break;
        }


        case 'CALL':
            q.push( this._build_call( entity, state.params ) );
            use.params = true;
            break;

        case 'GENERIC':
            throw new Error( 'GENERIC query cannot be built' );

        default:
            throw new Error( `Unsupported query type ${type}` );
        }

        if ( IS_DEBUG )
        {
            this._ensureUsed( state, use );
        }

        return q.join( '' );
    }

    _build_select_part( select )
    {
        const fields = [];

        for ( let [ f, v ] of select.entries() )
        {
            if ( v === f )
            {
                fields.push( `${f}` );
            }
            else
            {
                fields.push( `${v} AS ${f}` );
            }
        }

        return fields.join( ',' );
    }

    _build_call( entity, params )
    {
        return `CALL ${entity}(${params.join( ',' )})`;
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
     * Wrapper for raw expressions
     */
    static get Expression()
    {
        return Expression;
    }

    /**
     * Interface of Prepared statement
     */
    static get Prepared()
    {
        return Prepared;
    }

    /**
     * Base for Helpers
     */
    static get Helpers()
    {
        return Helpers;
    }

    /**
     * Base for SQLHelpers
     */
    static get SQLHelpers()
    {
        return SQLHelpers;
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
                type: type ? type.toUpperCase() : 'GENERIC',
                entity: this.helpers().entity( entity ),
                select: new Map(),
                toset: new Map(),
                multiset: null,
                where: [],
                having: [],
                group: [],
                order: [],
                limit: null,
                joins: [],
                params: [],
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
            if ( typeof impl.prototype === 'object' &&
                impl.prototype instanceof IDriver )
            {
                impl = new impl;
            }
            else
            {
                impl = impl();
            }
        }
        else
        {
            throw new Error( 'Not supported driver definition' );
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
        return this.helpers().escape( value );
    }

    /**
     * Escape identifier for embedding into raw query
     * @param {string} name - raw identifier to escape
     * @returns {string} driver-specific escape
     */
    identifier( name )
    {
        return this.helpers().identifier( name );
    }

    /**
     * Wrap raw expression to prevent escaping.
     * @param {string} expr - expression to wrap
     * @return {Expression} wrapped expression
     */
    expr( expr )
    {
        return this.helpers().expr( expr );
    }


    /**
     * Wrap parameter name to prevent escaping.
     * @param {string} name - name to wrap
     * @return {Expression} wrapped expression
     */
    param( name )
    {
        return this.expr( `:${name}` );
    }

    /**
     * Get additional helpers
     * @returns {Helpers} - db-specific helpers object
     */
    helpers()
    {
        return this.getDriver().helpers;
    }

    /**
     * Set fields to retrieve.
     *
     * Can be called multiple times for appending.
     * @p fields can be a Map or object:
     * - keys are field names as is
     * - values - any expression which is not being escaped automatically
     * @p fields can be a list of field names (array)
     * - values - field names
     * @p fields can be a single string
     * - optional @p value is expresion
     *
     * Value can be another QueryBuilder instance.
     *
     * @param {Map|object|string|array} fields - see concept for details
     * @param {*} [value=undefined] - optional value for
     * @returns {QueryBuilder} self
     */
    get( fields, value=undefined )
    {
        const select = this._state.select;
        const driver = this.getDriver();
        const helpers = driver.helpers;

        if ( value !== undefined )
        {
            driver.checkField( fields );
            select.set( fields, helpers.expr( value ) );
        }
        else if ( fields instanceof Map )
        {
            for ( let [ f, v ] of fields.entries() )
            {
                driver.checkField( f );
                select.set( f, helpers.expr( v ) );
            }
        }
        else if ( fields instanceof Array )
        {
            for ( let f of fields )
            {
                driver.checkField( f );
                select.set( f, f );
            }
        }
        else if ( typeof fields === 'object' )
        {
            for ( let f in fields )
            {
                driver.checkField( f );
                select.set( f, helpers.expr( fields[f] ) );
            }
        }
        else if ( typeof fields === 'string' )
        {
            driver.checkField( fields );
            select.set( fields, fields );
        }
        else
        {
            throw new Error( `Not supported fields definition: ${fields}` );
        }

        return this;
    }


    /**
     * Database neutral way to request last insert ID
     *
     * For databases without RETURNING or OUTPUT clause in INSERT it
     * is expected to always return '$id' field on insert.
     *
     * For others, it would build a valid RETURNING/OUTPUT clause.
     *
     * @param {string} field - field name with auto-generated value
     * @returns {QueryBuilder} self
     */
    getInsertID( field )
    {
        const select = this._state.select;
        const driver = this.getDriver();

        driver.checkField( field );
        select.set( '$id', field );

        return this;
    }

    /**
     * Save current set() context and start new INSERT row
     * @returns {QueryBuilder} self
     */
    newRow()
    {
        const state = this._state;

        if ( state.type !== 'INSERT' )
        {
            throw new Error( 'Not an INSERT query for multi-row' );
        }

        if ( state.toset instanceof Array )
        {
            throw new Error( 'INSERT-SELECT can not be mixed with multirow' );
        }

        if ( !state.multiset )
        {
            state.multiset = [];
        }

        if ( state.toset.size )
        {
            state.multiset.push( state.toset );
            state.toset = new Map();
        }

        return this;
    }

    /**
     * Add fields to set in UPDATE query.
     *
     * @p fields can be Map or object to setup multiple fields at once.
     * - keys - key name as is, no escape
     * - value - any value to be escaped or QueryBuilder instance
     *
     * Single field => value can be used as shortcut for object form.
     *
     * @param {Map|object|string} field - field(s) to assign
     * @param {string|number|null|QueryBuilder} [value=undefined] - value to assign
     * @returns {QueryBuilder} self
     */
    set( field, value=undefined )
    {
        const toset = this._state.toset;
        const driver = this.getDriver();
        const helpers = driver.helpers;

        if ( toset instanceof Array )
        {
            throw new Error( 'INSERT-SELECT can not be mixed with others' );
        }

        if ( value !== undefined )
        {
            driver.checkField( field );
            toset.set( field, helpers.escape( value ) );
        }
        else if ( field instanceof Map )
        {
            for ( let [ f, v ] of field.entries() )
            {
                driver.checkField( f );
                toset.set( f, helpers.escape( v ) );
            }
        }
        else if ( field instanceof QueryBuilder )
        {
            if ( toset.size )
            {
                throw new Error( 'INSERT-SELECT can not be mixed with others' );
            }

            if ( field._state.type !== 'SELECT' )
            {
                throw new Error( 'Not a SELECT sub-query' );
            }

            if ( this._state.type !== 'INSERT' )
            {
                throw new Error( 'Not an INSERT query for INSERT-SELECT' );
            }

            this._state.toset = [ Array.from( field._state.select.keys() ), field._toQuery() ];
        }
        else if ( typeof field === 'object' )
        {
            for ( let f in field )
            {
                driver.checkField( f );
                toset.set( f, helpers.escape( field[f] ) );
            }
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
     * @param {*} [value=undefined] - optional value for single field
     * @returns {QueryBuilder} self
     */
    where( conditions, value=undefined )
    {
        if ( value !== undefined )
        {
            conditions = { [conditions]: value };
        }

        this._processConditions( this._state.where, conditions );
        return this;
    }


    /**
     * Control "HAVING" part
     * @param {*} conditions - constraints to add
     * @param {*} [value=undefined] - optional value for single field
     * @returns {QueryBuilder} self
     * @see QueryBuilder.where
     */
    having( conditions, value=undefined )
    {
        if ( value !== undefined )
        {
            conditions = { [conditions]: value };
        }

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
    join( type, entity, conditions=undefined )
    {
        const joins = this._state.joins;
        const cond = [];

        if ( conditions )
        {
            this._processConditions( cond, conditions );
        }

        entity = this.helpers().entity( entity );
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
    innerJoin( entity, conditions=undefined )
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
    leftJoin( entity, conditions=undefined )
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
        const q = this._toQuery( unsafe_dml );
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
            const rows = this._lface.associateResult( res );
            as.success( rows, res.affected );
        } );
    }

    /**
     * Prepare statement for efficient execution multiple times
     * @param {Boolean} unsafe_dml - raise error, if DML without conditions
     * @returns {ExecPrepared} closue with prepared statement
     */
    prepare( unsafe_dml=false )
    {
        const q = this._toQuery( unsafe_dml );
        const iface = this._lface;

        return new class extends Prepared
        {
            execute( as, params=null )
            {
                if ( params )
                {
                    iface.paramQuery( as, q, params );
                }
                else
                {
                    iface.query( as, q );
                }
            }

            executeAssoc( as, params )
            {
                this.execute( as, params );

                as.add( ( as, res ) =>
                {
                    const rows = iface.associateResult( res );
                    as.success( rows, res.affected );
                } );
            }
        };
    }

    _toQuery( unsafe_dml=true )
    {
        const state = this._state;

        if ( !unsafe_dml &&
            ( state.type !== 'SELECT' ) &&
            ( state.type !== 'INSERT' ) &&
            !state.where.length )
        {
            throw new Error( 'Unsafe DML' );
        }


        return this.getDriver().build( state );
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
            const helpers = this.helpers();
            const confField = ( f, v ) =>
            {
                const m = f.match( COND_RE );
                let op = '=';

                if ( m )
                {
                    f = m[1];
                    op = m[2];
                }

                return [
                    COND,
                    f,
                    op,
                    helpers.escape( v, op ),
                ];
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

    _callParams( args )
    {
        const params = this._state.params;
        const helpers = this.helpers();
        args.forEach( ( v ) => params.push( helpers.escape( v ) ) );
        return this;
    }

    toString()
    {
        return this._toQuery( true );
    }

    static _replaceParams( helpers, q, params, used_params=null )
    {
        for ( let p in params )
        {
            let v = helpers.escape( params[p] );
            let nq = q.replace(
                new RegExp( `(:${p})($|\\W)`, 'g' ),
                `${v}$2` );

            if ( nq === q )
            {
                if ( !used_params ) throw new Error( `Unused param "${p}"` );
            }
            else if ( used_params )
            {
                used_params[p] = true;
            }

            q = nq;
        }

        return q;
    }
}

module.exports = QueryBuilder;
