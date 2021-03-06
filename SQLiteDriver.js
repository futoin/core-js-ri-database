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
const Expression = QueryBuilder.Expression;
const moment = require( 'moment' );

class SQLiteHelpers extends QueryBuilder.SQLHelpers {
    now() {
        return new Expression( 'CURRENT_TIMESTAMP' );
    }

    date( value ) {
        return moment.utc( value ).format( 'YYYY-MM-DD HH:mm:ss' );
    }

    nativeDate( value ) {
        return moment.utc( value );
    }

    dateModify( expr, seconds ) {
        if ( !seconds ) {
            return expr;
        }

        if ( typeof seconds !== 'number' ) {
            throw new Error( 'Seconds must be a number' );
        }

        expr = `datetime(${expr}, '${seconds} seconds')`;
        return new Expression( expr );
    }

    _escapeSimple( value ) {
        switch ( typeof value ) {
        case 'boolean':
            return value ? 'TRUE' : 'FALSE';

        case 'string':
            return `'${value.replace( /'/g, "''" )}'`;

        case 'number':
            return `${value}`;

        default:
            if ( value === null ) {
                return 'NULL';
            }

            if ( value instanceof Expression ) {
                return value.toQuery();
            }

            throw new Error( `Unknown type: ${typeof value}` );
        }
    }

    identifier( name ) {
        return name
            .split( '.' )
            .map( v => ( v === '*' ) ? v : `"${v.replace( /"/g, '""' ).replace( /\\/g, "\\\\" )}"` )
            .join( '.' );
    }

    cast( a, type ) {
        if ( type.toUpperCase() === 'JSON' ) {
            type = 'TEXT';
        }

        return super.cast( a, type );
    }

    least( ...args ) {
        const escaped = args.map( ( v ) => this.escape( v ) );
        return new Expression( `MIN(${escaped.join( ',' )})` );
    }

    greatest( ...args ) {
        const escaped = args.map( ( v ) => this.escape( v ) );
        return new Expression( `MAX(${escaped.join( ',' )})` );
    }
}

/**
 * SQLite driver for QueryBuilder
 *
 * @note It is normally automatically added when main.js is executed.
 * @private
 */
class SQLiteDriver extends QueryBuilder.SQLDriver {
    constructor() {
        super( new SQLiteHelpers );
    }

    build( state ) {
        if ( state.type === 'INSERT' &&
             state.select.size === 1 &&
             state.select.keys().next().value === '$id' ) {
            // last insert ID is always selected as '$id'
            const pure_state = Object.create( state );
            pure_state.select = null;

            return super.build( pure_state );
        } else if ( state.type === 'SELECT' && state.forClause ) {
            const pure_state = Object.create( state );
            pure_state.forClause = null;

            // Ignore as whole DB is locked
            return super.build( pure_state );
        }

        return super.build( state );
    }

    _build_call( _entity, _params ) {
        throw new Error( 'Not supported' );
    }
}

module.exports = SQLiteDriver;
