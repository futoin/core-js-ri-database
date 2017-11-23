'use strict';

const QueryBuilder = require( './QueryBuilder' );
const SqlString = require( 'sqlstring' );
const Expression = QueryBuilder.Expression;
const moment = require( 'moment' );

class MySQLHelpers extends QueryBuilder.SQLHelpers
{
    now()
    {
        return new Expression( 'UTC_TIMESTAMP()' );
    }

    date( value )
    {
        return moment.utc( value ).format( 'YYYY-MM-DD HH:mm:ss' );
    }

    nativeDate( value )
    {
        return moment.utc( value );
    }

    dateModify( expr, seconds )
    {
        if ( !seconds )
        {
            return expr;
        }

        if ( typeof seconds !== 'number' )
        {
            throw new Error( 'Seconds must be a number' );
        }

        // MySQL should be OK even with fractional seconds
        expr = `(${expr} + INTERVAL ${seconds} SECOND)`;
        return new Expression( expr );
    }

    _escapeSimple( value )
    {
        switch ( typeof value )
        {
        case 'boolean':
        case 'string':
        case 'number':
            return SqlString.escape( value );

        default:
            if ( value === null )
            {
                return 'NULL';
            }

            if ( value instanceof Expression )
            {
                return value.toQuery();
            }

            throw new Error( `Unknown type: ${typeof value}` );
        }
    }

    identifier( name )
    {
        return SqlString.escapeId( name );
    }

    concat( ...args )
    {
        const escaped = args.map( ( v ) => this.escape( v ) );
        return new Expression( `CONCAT(${escaped.join( ',' )})` );
    }

    cast( a, type )
    {
        switch ( type.toUpperCase() )
        {
        case 'TEXT':
            type = 'CHAR';
            break;

        case 'BLOB':
            type = 'BINARY';
            break;
        }

        return super.cast( a, type );
    }
}

/**
 * MySQL driver for QueryBuilder
 *
 * @note It is normally automatically added when main.js is executed.
 * @private
 */
class MySQLDriver extends QueryBuilder.SQLDriver
{
    constructor()
    {
        super( new MySQLHelpers );
    }

    build( state )
    {
        if ( state.type === 'INSERT' &&
             state.select.size === 1 &&
             state.select.keys().next().value === '$id' )
        {
            // last insert ID is always selected as '$id'
            const pure_state = Object.create( state );
            pure_state.select = null;

            return super.build( pure_state );
        }
        else if ( state.type === 'SELECT' && state.forClause )
        {
            const pure_state = Object.create( state );
            pure_state.forClause = null;

            const q = super.build( pure_state );

            switch ( state.forClause )
            {
            case 'UPDATE':
                return `${q} FOR UPDATE`;

            case 'SHARE':
                return `${q} LOCK IN SHARE MODE`;
            }
        }

        return super.build( state );
    }
}

module.exports = MySQLDriver;
