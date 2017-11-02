'use strict';

const QueryBuilder = require( './QueryBuilder' );
const Expression = QueryBuilder.Expression;
const moment = require( 'moment' );

class SQLiteHelpers extends QueryBuilder.Helpers
{
    now()
    {
        return new Expression( 'CURRENT_TIMESTAMP' );
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

        expr = `datetime(${expr}, '${seconds} seconds')`;
        return new Expression( expr );
    }
}

/**
 * SQLite driver for QueryBuilder
 *
 * @note It is normally automatically added when main.js is executed.
 * @private
 */
class SQLiteDriver extends QueryBuilder.SQLDriver
{
    constructor()
    {
        super( new SQLiteHelpers );
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

            // Ignore as whole DB is locked
            return super.build( pure_state );
        }

        return super.build( state );
    }

    _build_call( _entity, _params )
    {
        throw new Error( 'Not supported' );
    }

    _escapeSimple( value )
    {
        switch ( typeof value )
        {
        case 'boolean':
            return value ? 'TRUE' : 'FALSE';

        case 'string':
            return `'${value.replace( /'/g, "''" ).replace( /\\/g, "\\\\" )}'`;

        case 'number':
            return `${value}`;

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
        return name
            .split( '.' )
            .map( v => ( v === '*' ) ? v : `"${v.replace( /"/g, '""' ).replace( /\\/g, "\\\\" )}"` )
            .join( '.' );
    }
}

module.exports = SQLiteDriver;
