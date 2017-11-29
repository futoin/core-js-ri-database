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

const QueryBuilder = require( './QueryBuilder' );
const NO_ESCAPE_RE = /^(.*\.)*(([a-z0-9][a-z_0-9])|\*)$/;
const Expression = QueryBuilder.Expression;
const moment = require( 'moment' );

class PostgreSQLHelpers extends QueryBuilder.SQLHelpers
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

        // PostgreSQL should be OK even with fractional seconds
        expr = `((${expr})::timestamp + interval '${seconds} second')`;
        return new Expression( expr );
    }

    _escapeSimple( value )
    {
        switch ( typeof value )
        {
        case 'boolean':
            return value ? 'TRUE' : 'FALSE';

        case 'string': {
            value = value.replace( /'/g, "''" );

            if ( value.indexOf( '\\' ) >= 0 )
            {
                return `E'${value.replace( /\\/g, "\\\\" )}'`;
            }

            return `'${value}'`;
        }

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

    cast( a, type )
    {
        switch ( type.toUpperCase() )
        {
        case 'BLOB':
            type = 'BYTEA';
            break;
        }

        const expr = this.escape( a );
        return new Expression( `${expr}::${type}` );
    }
}

/**
 * PostgreSQL driver for QueryBuilder
 *
 * @note It is normally automatically added when main.js is executed.
 * @private
 */
class PostgreSQLDriver extends QueryBuilder.SQLDriver
{
    constructor()
    {
        super( new PostgreSQLHelpers );
    }

    build( state )
    {
        switch ( state.type )
        {
        case 'SELECT': {
            const forClause = state.forClause;

            if ( forClause )
            {
                const pure_state = Object.create( state );
                pure_state.forClause = null;

                const q = super.build( pure_state );

                switch ( forClause )
                {
                case 'UPDATE':
                    return `${q} FOR UPDATE`;

                case 'SHARE':
                    return `${q} FOR SHARE`;
                }
            }

            break;
        }

        case 'DELETE':
        case 'INSERT':
        case 'UPDATE': {
            const select = state.select;

            if ( select.size )
            {
                const pure_state = Object.create( state );
                pure_state.select = null;

                const q = super.build( pure_state );
                const q_select = this._build_select_part( select );

                return `${q} RETURNING ${q_select}`;
            }

            break;
        }
        }

        return super.build( state );
    }

    _build_select_part( select )
    {
        const fields = [];
        const helpers = this.helpers;

        for ( let [ f, v ] of select.entries() )
        {
            // PostgreSQL forces lower case for not escaped identifiers
            if ( v === f )
            {
                if ( f.match( NO_ESCAPE_RE ) )
                {
                    fields.push( `${f}` );
                }
                else
                {
                    f = f.split( '.' );
                    f = f[ f.length - 1 ];
                    f = helpers.identifier( f );
                    fields.push( `${v} AS ${f}` );
                }
            }
            else
            {
                f = helpers.identifier( f );
                fields.push( `${v} AS ${f}` );
            }
        }

        return fields.join( ',' );
    }

    _build_call( entity, params )
    {
        return `SELECT * FROM ${entity}(${params.join( ',' )})`;
    }
}

module.exports = PostgreSQLDriver;
