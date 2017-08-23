'use strict';

const QueryBuilder = require( './QueryBuilder' );
const SqlString = require( 'sqlstring' );

/**
 * MySQL driver for QueryBuilder
 * 
 * @note It is normally automatically added when main.js is executed.
 */
class MySQLDriver extends QueryBuilder.SQLDriver
{
    build( state )
    {
        if ( state.type === 'INSERT' &&
             state.select.size === 1 &&
             state.select.keys().next().value === '$id' )
        {
            const pure_state = Object.create( state );
            pure_state.select = null;

            return super.build( pure_state );
        }
        else
        {
            return super.build( state );
        }
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

            if ( value instanceof QueryBuilder.Expression )
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
}

module.exports = MySQLDriver;
