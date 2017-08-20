'use strict';

const QueryBuilder = require( './QueryBuilder' );

/**
 * PostgreSQL driver for QueryBuilder
 * 
 * @note It is normally automatically added when main.js is executed.
 */
class PostgreSQLDriver extends QueryBuilder.SQLDriver
{
    build( state )
    {
        if ( state.type !== 'SELECT' && state.select.size )
        {
            const pure_state = Object.create( state );
            pure_state.select = null;

            const q = super.build( pure_state );
            const select = this._build_select_part( state.select );

            return `${q} RETURNING ${select}`;
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

            if ( value instanceof QueryBuilder.Expression )
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
            .map( v => `"${v.replace( /"/g, '""' ).replace( /\\/g, "\\\\" )}"` )
            .join( '.' );
    }
}

module.exports = PostgreSQLDriver;
