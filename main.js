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
const L1Face = require( './L1Face' );
const L2Face = require( './L2Face' );

QueryBuilder.addDriver( 'mysql', './MySQLDriver' );
QueryBuilder.addDriver( 'postgresql', './PostgreSQLDriver' );
QueryBuilder.addDriver( 'sqlite', './SQLiteDriver' );

module.exports = {
    QueryBuilder,
    L1Face,
    L2Face,
};
