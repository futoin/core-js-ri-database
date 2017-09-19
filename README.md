
  [![NPM Version](https://img.shields.io/npm/v/futoin-database.svg?style=flat)](https://www.npmjs.com/package/futoin-database)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-database.svg?style=flat)](https://www.npmjs.com/package/futoin-database)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-database.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-database)
  [![stable](https://img.shields.io/badge/stability-stable-green.svg?style=flat)](https://www.npmjs.com/package/futoin-database)

  [![NPM](https://nodei.co/npm/futoin-database.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-database/)

# FutoIn reference implementation

Reference implementation of:
 
    FTN17: FutoIn Interface - Database
    Version: 1.0
    
* Spec: [FTN17: FutoIn Interface - Database v1.x](http://specs.futoin.org/final/preview/ftn17_if_database-1.html)

Author: [Andrey Galkin](mailto:andrey@futoin.org)

[Web Site](http://futoin.org/)

# About

Database neutral microservice interface with advanced Query and revolutionary Transaction builder.

Auto-configuration based on process environment variables and connection pooling by design.

At the moment, the following databases are supported our of the box:
* MySQL
* PostgreSQL
* SQLite
* Any custom plugin extending `L?Service` and implementing `IDriver` query builder helper
    which should be registered through `AutoConfig.register` and `QueryBuilder.addDriver()` calls.
    
*Note: note specific database support is to be split into separate packages at some point. Meanwhile, please
use `yarn install --ignore-optional` to minimize deps.*

# Installation for Node.js

Command line:
```sh
$ npm install futoin-database --save
```

# Concept

Interface is split into several levels which are combined in inheritance chain.

Fundamental difference from traditional interfaces is lack of large
result set support, cursors and explicit transaction control. This is
done by intention to forbid undesired database operation patterns.

## Level 1

The very basic level for query execution with minimal safety requirements.

## Level 2

Transaction execution abstraction with "single call" pattern.

The overall idea is to execute a list of statements on DB side in single transaction
one-by-one. After each xfer, trivial validation is done like amount of affected rows
or count of rows in result. This allows creating complex intermediate checks in
native DB query. Such pattern avoids blocking usually expensive DB connections
and forces to execute transaction with no client-side delays. Also, proper release
of connection to DB connection pool is ensured.

For cases, when one of later queries requires result data of previous queries
(e.g. last insert ID) a special mechanism of back references is implemented
which supports single and multiple (IN/NOT IN ops) value mode.

If at any step an error occurs then whole transaction is rolled back.

*Note: internally, it's assumed that there is a limited number of simultaneous
DB connection allowed which are managed in connection pool for performance reasons,
but such details are absolutely hidden from clients.*

## 2.3. Level 3

Large result streaming through BiDirectional channel.
Database metadata and ORM-like abstraction. TBD.

## 2.4. Implementation details

### Auto-configuration

`DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_DB` and `DB_MAXCONN` environment
variables are used to autoconfigure "default" connection.

`DB_{NAME}_TYPE`, `DB_{NAME}_HOST`, `DB_{NAME}_PORT` and other variable names are
used to configure any arbitrary "`{name}`" connection. The list of expected
connection names must be supplied to `AutoConfig()` function.

It possible to supply required/supported database type as "type" option of
preconfigured connection. Example:

```javascript
AutoConfig(as, ccm, {
    // DB_MAIN_TYPE must be either of these
    main : { type: ['mysql', 'postgresql'] },
    // DB_DWH_TYPE must be exactly this
    dwh : { type: 'postgresql' },
});
```

All connections are accessible through dependency-injection approach by fundamental design
of FutoIn Invoker CCM pattern. Specific CCM instance is extended with `.db(name='default')`.

All connections are registered with '#db.' prefix in CCM. Therefore, use of `ccm.db()` instead
of ccm.iface(`#db.${name}`) is strongly encouraged.

### Results

There is a single "raw" result object format:
* `.rows` - array of array of values
* `.fields` - array of field names in the same order as values in rows
* `.affected` - amount of affected rows by last operation (it's quite database specific).
    - *Note: to get actual changed row count, try to use extra .where() conditions with `<>` of set values*

As such transmission efficient format is not very handy for practical programming the
result can be manually associated through `iface.associateResult()` call.
* `.rows` - array of objects with key => value pairs
* `.affected` - the same as in original raw response

The same can be implicitly achieved through using `QueryBuilder#executeAssoc()`,
`XferBuilder#executeAssoc()` and `Prepared#executeAssoc()`. Format of next AsyncStep:
* `(as, rows, affected) => {}`
    - `rows` and `affected` directly correspond to fields of associated result
    
### Transaction results

The format of inividual query is the same as for single queries, but extended with `.seq` field
corresponding to # of query in original list. It can be used for safety checks.

*Note: query result is not returned, unless `{ result: true}` query option is set - that's done by intention as normally result of only a single SELECT is required while the rest is covered with Transaction Conditions.*

### Insert ID

It's a known painful moment in many abstractions. For databases like
MySQL last insert ID is always "selected" as special `$id` result field.

For `QueryBuilder` abstraction please use `getInsertID(id_field)` call
for cross-database compatibility.

### Conditions

WHERE, HAVING and JOIN support the same approach to conditions:
1. raw string is treated as is and joined with outer scope AND or OR operator
2. Object and Map instance is treated as key=>value pairs joined with AND operator
    - all values are auto-escaped, unless wrapped with `QueryBuilder#expr()` call
    - all keys may have `"{name} {op}"` format, where `{op}` is one of:
        * `=` - equal
        * `<>` - not equal
        * `>` - greater
        * `>=` - greater or equal
        * `<` - less
        * `<=` - less or equal
        * `IN` - in array or sub-query (assumed)
        * `NOT IN` - not in array or sub-query (assumed)
        * `BETWEEN` - two value tuple is assumed for inclusive range match
        * `NOT BETWEEN` - two value tuple is assumed for inverted inclusive range match
        * `LIKE` - LIKE match
        * `NOT LIKE` - NOT LIKE match
        * other ops may be implicitly supported
3. Array - the most powerful condition builder - almost internal representation
    - first element is operator for entire scope: 'AND' (default) or 'OR'
    - all following elements can be:
        * raw strings
        * Objects or Maps
        * inner arrays with own scope operator
        * another QueryBuilder instance to be used as sub-query

### Transaction conditions

Normally, during transaction execution, we are interested that some operation 
does modifications successfully, but we do not need its actual result.

The following query options are supported inside transaction:
* `result=false` - if true then result must be returned in result list of `L2Face#xfer()` call
* `affected=null`
    - `boolean` - check if there affected rows (true) or no affected rows (false)
    - `integer` - if amount of affected rows exactly matches the value
* `affected=null`
    - `boolean` - check if amount of affected rows exactly matches the value
    - `integer` - check if amount of selected rows exactly matches the value
    
### Transaction result value back references

Very often, we insert main object and then insert associated object and need to
use auto-generated values like primary ID keys from the previous query.

Another case, is when we do SELECT-FOR-UPDATE query and need to modify exactly those rows.

There is a special `XferQueryBuilder#backref(qb, field, multi=false)` placeholder supported.
The function must be called on exactly the target `XferQueryBuilder` object. Example:
```javascript
const xfer db.newXfer();
const sel_q = xfer.select('Tbl').get('id').where('name LIKE', 'abc%').forUpdate();
const upd_q = xfer.update('Tbl');
upd_q.set('name', upd_q.expr("CONCAT('UPD_', name)")
    .where('id IN', upd_q.backref(sel_q, 'id', true);
xfer.execute(as);
```

### Transaction isolation levels

All standard ACID isolation levels are supported: READ UNCOMMITTED, READ COMMITTED,
REPEATEABLE READ and SERIALIZABLE. Please use related `L2Face` constants. Example:
```javascript
const db = ccm.db();
db.newXfer(db.REPEATABLE_READ);
```

### Sub-queries

Everywhere specific database implementation allows sub-queries, they can be used:

1. As select or join entity - alias must be provided in array format:
    - `[QueryBuilder(), 'Alias']`
2. As any condition value part, except raw strings
3. As expression for .get(alias, expr) calls

### Efficient execution (prepared QueryBuilder & XferQueryBuilder)

Obviously, executing the same steps to create the same query again and again
is not efficient, if only parameters change. Therefore, named value placeholders
are supported in format of "`:name`" in raw queries or wrapped with `.param('name')`
calls in QueryBuilder.

Both query and transaction builders support `.prepare()` call. All queries
get built into string templates for efficient repetitive execution.

### Error handling

All errors are regular FutoIn exceptions with error code and error info:
* `InvalidQuery` - broken query due to syntax or semantics
* `Duplicate` - unique key constraint violation
* `LimitTooHigh` - more than 1000 rows in result
* `DeadLock` - database deadlock detected in transaction
* `XferCondition` - violation of transaction condition constraints
* `XferBackRef` - invalid transaction value back reference
* `OtherExecError` - any other execution error

Example of use:
```javascript
as.add(
    (as) => db.query(...),
    (as, err_code) => {
        // AsyncSteps convention for error info and last exception
        console.log(as.state.error_info);
        console.log(as.state.last_exception);
        
        if (err_code === 'Duplicate') {
            // Example of ignoring Duplicate error
            as.success();
        }
    }
);
```

### QueryBuilder & XferBuilder cloning

Sometimes, 80+% of queries are the same and only a small part like filter-based
conditions or selected values are changed. For such cases, a special `.clone()`
member is provided. Example:
```javascript
// standalone query
const base_qb = db.select('SomeTbl').get(['id', 'name']);
base_qb.clone().where('id', 1(.execute(as);
base_qb.clone().where('id', 1(.execute(as);

// transaction
const base_xfer = db.newXfer();
base_xfer.select('SomeTbl').get(['id', 'name']).forSharedRead();

let xfer = base_xfer.clone();
base_xfer.insert('OtherTbl').set('name', 'abc');
xfer.executeAssoc(as);
```

# Examples

## 1. Raw queries

```javascript
/**
 * Process ENV variables:
 *
 * DB_TYPE=mysql
 * DB_HOST=127.0.0.1
 * DB_PORT=3306
 * DB_USER=testuser
 * DB_PASS=testpass
 * DB_DB=testdb
 * DB_MAXCONN=10
 */

const $as = require('futoin-asyncsteps');
const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
const DBAutoConfig = require('futoin-database/AutoConfig');

$as() // Root FutoIn AsyncSteps
    .add(
        // Root step body
        (as) => {
            // Setup main application CCM
            const ccm = new AdvancedCCM();
            // Configure default connection based on environment variables
            DBAutoConfig(as, ccm);
            
            // Next -> do query
            as.add((as) => {
                ccm.db().query(as, 'SELECT 1+2 AS Sum');
            });
            // Next -> handle result
            as.add((as, res) => {
                res = ccm.db().associateResult(res);
                console.log(`Sum: ${res[0].Sum}`);
            });
            // Ensure proper shutdown
            // All DB pools are automatically closed
            as.add((as) => {
                ccm.close();
            });
        },
        // Overall error handler
        (as, err) => {
            console.log(`${err}: ${as.state.error_info}`);
            console.log(as.state.last_exception);
        }
    )
    // Start execution
    .execute();
```

## 2. Query Builder

```javascript
// Setup main application CCM
const ccm = new AdvancedCCM();
// Configure default connection based on environment variables
DBAutoConfig(as, ccm);

// Next -> run queries
as.add((as) => {
    const db = ccm.db();
    let q;
    
    // prepare table
    // ---
    db.query(as, 'DROP TABLE IF EXISTS SomeTbl');
    db.query(as, 'CREATE TABLE SomeTbl(' +
            'id int auto_increment primary key,' +
            'name varchar(255) unique)');
    
    // insert some data
    // ---
    // - simple set
    db.insert('SomeTbl').set('name', 'abc').execute(as);
    // - set as object key=>value pairs
    db.insert('SomeTbl').set({name: 'klm'}).execute(as);
    // - set with Map key=>value pairs
    db.insert('SomeTbl')
        .set(new Map([['name', 'xyz']]))
        .getInsertID('id')
        .executeAssoc(as);
    // use insert ID
    as.add((as, res, affected) => console.log(`Insert ID: ${res[0].$id}`));
    
    // INSERT-SELECT like query
    // ---
    // sub-query must be the only parameter for .set()
    db.insert('SomeTbl').set(
        // DANGER: .get() expects expressions and does not escape them!
        db.select('SomeTbl').get('name', "CONCAT('INS', name)").where('id <', 3)
    ).execute(as);
    
    // update data
    const qb = db.queryBuilder(); // generic query builder for helper API
    
    q = db.update('SomeTbl')
        // - .set can be called multiple times
        .set('id', 10)
        // - please note that set auto-escapes all values, unless wrapped with .expr()
        .set('name', qb.expr('CONCAT(id, name)'))
        // - simple condition
        .where('name', 'klm')
        // - extra calls are implicit "AND"
        // - Most powerful array-based definition which is
        //      very close to how all conditions are handled internally.
        .where([
            'OR', // The scope of OR is only children of this array
            // object as member, all fields are AND assumed
            {
                // there are various generic suppported operators
                'name LIKE': 'kl%',
                // another example
                'id >': 1,
            },
            // Inner complex array
            [
                'AND', // this can be omitted as "AND" is implicit for arrays
                // raw expression as string - DANGER of SQLi, please avoid
                'name NOT LIKE \'xy%\'',
                // another example of operator with two values
                { 'id BETWEEN': [1, 10] }
            ],
            // Note: Map object can also be used
        ]);

    // Dump raw query for inspection
    console.log(`Query: ${q}`);
    // UPDATE SomeTbl SET id=10,name=CONCAT(id, name) WHERE name = 'klm' AND (name LIKE 'kl%' OR id > 1 OR (name NOT LIKE 'xy%' AND id BETWEEN 1 AND 10))
    
    // Finally, execute it
    q.execute(as);

    // Select without entity
    // ---
    db.select().get('atm', 'NOW()').executeAssoc(as);
    as.add((as, res) => console.log(`At the moment: ${res[0].atm}`));
    
    // Select with join of result of sub-query (instead of normal table)
    // ---
    q = db.select('SomeTbl')
        .innerJoin(
            // sub-query
            // NOTE: use of .escape() for .get()
            [ db.select().get('addr', qb.escape('Street 123')), 'Alias'],
            // all where-like conditions are supported here
            '1 = 1' // can be omitted
        );
    console.log(`Query: ${q}`);
    // SELECT * FROM SomeTbl INNER JOIN (SELECT 'Street 123' AS addr) AS Alias ON 1 = 1
    q.executeAssoc(as);
    // inspect result
    as.add((as, res) => console.log(res));
    /*
     * [
     *  { id: 10, name: '10klm', addr: 'Street 123' },
     *  { id: 1, name: 'abc', addr: 'Street 123' },
     *  { id: 4, name: 'INSabc', addr: 'Street 123' },
     *  { id: 5, name: 'INSklm', addr: 'Street 123' },
     *  { id: 3, name: 'xyz', addr: 'Street 123' },
     * ]
     */
});
```

## 3. Efficient Query Builder (prepared)

```javascript
// create a prepared statement with query builder
// ---
const qb = db.queryBuilder(); // helper instance
const prepared_q = db.insert('SomeTbl')
    // notice .param() placeholder
    .set('name', qb.param('nm'))
    .getInsertID('id')
    .prepare();

for (let nm of ['abc', 'klm', 'xyz']) {
    // prepared_q is not QueryBuilder, but Prepared object
    prepared_q.executeAssoc(as, {nm});
    as.add((as, res) =>
        console.log(`Inserted ${nm} ID ${res[0].$id}`));
}

// Inserted abc ID 1
// Inserted klm ID 2
// Inserted xyz ID 3

// raw param query
// ---
// Not recommended raw example  with the same execution speed
const raw_q = `INSERT INTO SomeTbl SET name = :nm`;

for (let nm of ['abc2', 'klm2', 'xyz2']) {
    db.paramQuery(as, raw_q, {nm});
    as.add((as, res) =>
        console.log(`Inserted ${nm} ID ${res.rows[0][0]}`));
}

// Inserted abc2 ID 4
// Inserted klm2 ID 5
// Inserted xyz2 ID 6
```

## 4. Simple Transaction Builder

```javascript
// create a transaction with builder
// ---
const xfer = db.newXfer(); // Read Committed by default

// already known QueryBuilder without execute() call
xfer.insert('SomeTbl').set('name', 'abc');
xfer.insert('SomeTbl').set('name', 'xyz');

// Note the the "result" option to include result in
// overall xfer result
xfer.select('SomeTbl', {result: true})
    .get('C', 'COUNT(*)')
    // add FOR-clause, if supported by DB
    .forUpdate();

// Return result of update and check that any rows are affected
xfer.update('SomeTbl', {result: true, affected: true})
    .set('name', 'klm').where('name', 'xyz');
    
// Run again making sure zero rows are affected
xfer.update('SomeTbl', {affected: 0})
    .set('name', 'klm').where('name', 'xyz');

// Execute of transaction itself
xfer.executeAssoc(as);

as.add((as, results) => {
    console.log(`Count: ${results[0].rows[0].C}`);
    console.log(`First UPDATE affected: ${results[1].affected}`);
});

// Count: 2
// First UPDATE affected: 1
```

## 5. Efficient Transaction Builder (prepared)

```javascript
// create a prepared transaction with builder
// ---
const xfer = db.newXfer(); // Read Committed by default

// already known QueryBuilder without execute() call
xfer.insert('SomeTbl').set('name', xfer.param('n1'));
xfer.insert('SomeTbl').set('name', xfer.param('n2'));

// Note the the "result" option to include result in
// overall xfer result
xfer.select('SomeTbl', {result: true})
    .get('C', 'COUNT(*)')
    .forSharedRead(); // another locking example

// Prepare transaction
const prepared_xfer = xfer.prepare();

// test data
const data = [
    { n1: 'abc', n2: 'xyz' },
    { n1: 'cba', n2: 'zyx' },
];
data.forEach((params, i) => {
    // Efficiently execute prepared transaction
    prepared_xfer.executeAssoc(as, params);

    as.add((as, results) => {
        console.log(`Count for ${i}: ${results[0].rows[0].C}`);
    });
});

// Count for 0: 2
// Count for 1: 4
```

## 6. Advanced Transaction Builder (prepared with back references)

```javascript
// create a prepared transaction with value back references
// ---
const xfer = db.newXfer(db.SERIALIZABLE);

// Insert some parametrized data
const ins1_q = xfer.insert('SomeTbl')
    .set('name', xfer.param('n1'))
    .getInsertID('id');
const ins2_q = xfer.insert('SomeTbl')
    .set('name', xfer.param('n2'))
    .getInsertID('id');

// Ensure two items are selected with brain-damaged conditions
const sel_q = xfer.select('SomeTbl', {selected: 2});
sel_q
    .get('id')
    .where([
        'OR',
        {'name': xfer.param('n1')},
        'id = ' + sel_q.backref(ins2_q, '$id'), // note object of .backref()
    ])
    .forUpdate();
    
// Make sure one row is updated with brain-damaged conditions
const upd_q = xfer.update('SomeTbl', {affected: 1});
upd_q
    .set('name',
            upd_q.expr(`CONCAT('klm', ${upd_q.backref(ins1_q, '$id')})`))
    .where('id IN', upd_q.backref(sel_q, 'id', true))
    .where('name', xfer.param('n1'));

// Prepare transaction
const prepared_xfer = xfer.prepare();

// test data
// ---
const data = [
    { n1: 'abc', n2: 'xyz' },
    { n1: 'cba', n2: 'zyx' },
];
data.forEach((params, i) => {
    // Efficiently execute prepared transaction
    prepared_xfer.executeAssoc(as, params);
});

// Let's see what we have
// ---
db.select('SomeTbl').executeAssoc(as);
as.add((as, res) => console.log(res));

// [ { id: 1, name: 'klm1' },
//   { id: 3, name: 'klm3' },
//   { id: 2, name: 'xyz' },
//   { id: 4, name: 'zyx' } ]
```

## 7. Multiple connections per application

```javascript
/**
 * Process ENV variables:
 *
 * DB_FIRST_TYPE=mysql
 * DB_FIRST_HOST=127.0.0.1
 * DB_FIRST_PORT=3306
 * DB_FIRST_USER=testuser
 * DB_FIRST_PASS=testpass
 * DB_FIRST_DB=testdb
 * DB_FIRST_MAXCONN=10
 * 
 * DB_SECOND_TYPE=postgresql
 * DB_SECOND_HOST=127.0.0.1
 * DB_SECOND_PORT=5432
 * DB_SECOND_USER=testuser
 * DB_SECOND_PASS=testpass
 * DB_SECOND_DB=testdb
 * DB_SECOND_MAXCONN=10
 */

// Configure required connections based on environment variables
DBAutoConfig(as, ccm, {
    first: {},
    second: {},
});

// Next -> do query
as.add((as) => {
    ccm.db('first').query(as, 'SELECT 1+2 AS Sum');
    as.add((as, res) => console.log(`First: ${res.rows[0][0]}`));
    
    ccm.db('second').query(as, 'SELECT 3+2 AS Sum');
    as.add((as, res) => console.log(`Second: ${res.rows[0][0]}`));
    
    // First: 3
    // Second: 5
});
```
    
# API documentation

The concept is described in FutoIn specification: [FTN17: FutoIn Interface - Database v1.x](http://specs.futoin.org/final/preview/ftn17_if_database-1.html)

## Classes

<dl>
<dt><a href="#L1Face">L1Face</a></dt>
<dd><p>Level 1 Database Face</p>
</dd>
<dt><a href="#L1Service">L1Service</a></dt>
<dd><p>Base for Level 1 Database service implementation</p>
</dd>
<dt><a href="#XferQuery">XferQuery</a></dt>
<dd></dd>
<dt><a href="#L2Face">L2Face</a></dt>
<dd><p>Level 2 Database Face</p>
</dd>
<dt><a href="#L2Service">L2Service</a></dt>
<dd><p>Base for Level 2 Database service implementation</p>
</dd>
<dt><a href="#MySQLService">MySQLService</a></dt>
<dd><p>MySQL service implementation for FutoIn Database interface.addEventListener()</p>
</dd>
<dt><a href="#PostgreSQLService">PostgreSQLService</a></dt>
<dd><p>PostgreSQL service implementation for FutoIn Database interface</p>
</dd>
<dt><a href="#Expression">Expression</a></dt>
<dd><p>Wrapper for raw expression to prevent escaping</p>
</dd>
<dt><a href="#Prepared">Prepared</a></dt>
<dd><p>Interface for prepared statement execution</p>
</dd>
<dt><a href="#Helpers">Helpers</a></dt>
<dd><p>Additional helpers interface</p>
</dd>
<dt><a href="#QueryBuilder">QueryBuilder</a></dt>
<dd><p>Neutral query builder</p>
</dd>
<dt><a href="#SQLiteService">SQLiteService</a></dt>
<dd><p>SQLite service implementation for FutoIn Database interface.addEventListener()</p>
</dd>
<dt><a href="#QueryOptions">QueryOptions</a></dt>
<dd></dd>
<dt><a href="#XferQueryBuilder">XferQueryBuilder</a></dt>
<dd><p>Version of QueryBuilder which forbids direct execution.</p>
</dd>
<dt><a href="#XferBuilder">XferBuilder</a></dt>
<dd><p>Transction builder.</p>
<p>Overall concept is build inividual queries to be executed without delay.
It&#39;s possible to add result constraints to each query for intermediate checks:</p>
<ul>
<li>affected - integer or boolean to check DML result</li>
<li>selected - integer or boolean to check DQL result</li>
<li>result - mark query result to be returned in response list</li>
</ul>
</dd>
</dl>

## Members

<dl>
<dt><a href="#AutoConfig">AutoConfig</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#now">now()</a> ⇒ <code><a href="#Expression">Expression</a></code></dt>
<dd><p>Get DB-specific current timestamp expression</p>
</dd>
<dt><a href="#date">date(value)</a> ⇒ <code><a href="#Expression">Expression</a></code></dt>
<dd><p>Convert native timestamp to DB format</p>
</dd>
<dt><a href="#nativeDate">nativeDate(value)</a> ⇒ <code>moment</code></dt>
<dd><p>Convert DB timestamp to native format</p>
</dd>
<dt><a href="#dateModify">dateModify(expr, seconds)</a> ⇒ <code><a href="#Expression">Expression</a></code></dt>
<dd><p>Create expression representing date modification of
input expression by specified number of seconds.</p>
</dd>
</dl>

<a name="L1Face"></a>

## L1Face
Level 1 Database Face

**Kind**: global class  

* [L1Face](#L1Face)
    * _instance_
        * [.query](#L1Face+query)
        * [.callStored](#L1Face+callStored)
        * [.getFlavour(as)](#L1Face+getFlavour)
        * [.queryBuilder(type, entity)](#L1Face+queryBuilder) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.delete(entity)](#L1Face+delete) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.insert(entity)](#L1Face+insert) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.select(entity)](#L1Face+select) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.update(entity)](#L1Face+update) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.paramQuery(as, q, params)](#L1Face+paramQuery)
        * [.associateResult(as_result)](#L1Face+associateResult) ⇒ <code>array</code>
    * _static_
        * [.LATEST_VERSION](#L1Face.LATEST_VERSION)
        * [.PING_VERSION](#L1Face.PING_VERSION)
        * [.register(as, ccm, name, endpoint, [credentials], [options])](#L1Face.register)

<a name="L1Face+query"></a>

### l1Face.query
**Kind**: instance property of [<code>L1Face</code>](#L1Face)  
**Note**: AS result has "rows", "fields" and "affected" members  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| q | <code>string</code> | raw query |

<a name="L1Face+callStored"></a>

### l1Face.callStored
**Kind**: instance property of [<code>L1Face</code>](#L1Face)  
**Note**: see query() for results  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| name | <code>string</code> | stored procedure name |
| args | <code>array</code> | positional arguments to pass |

<a name="L1Face+getFlavour"></a>

### l1Face.getFlavour(as)
Get type of database

**Kind**: instance method of [<code>L1Face</code>](#L1Face)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |

<a name="L1Face+queryBuilder"></a>

### l1Face.queryBuilder(type, entity) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Get neutral query builder object.

**Kind**: instance method of [<code>L1Face</code>](#L1Face)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - associated instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| type | <code>string</code> | <code>null</code> | Type of query: SELECT, INSERT, UPDATE, DELETE, ... |
| entity | <code>string</code> | <code>null</code> | table/view/etc. name |

<a name="L1Face+delete"></a>

### l1Face.delete(entity) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Get neutral query builder for DELETE

**Kind**: instance method of [<code>L1Face</code>](#L1Face)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - associated instance  

| Param | Type | Description |
| --- | --- | --- |
| entity | <code>string</code> | table/view/etc. name |

<a name="L1Face+insert"></a>

### l1Face.insert(entity) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Get neutral query builder for INSERT

**Kind**: instance method of [<code>L1Face</code>](#L1Face)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - associated instance  

| Param | Type | Description |
| --- | --- | --- |
| entity | <code>string</code> | table/view/etc. name |

<a name="L1Face+select"></a>

### l1Face.select(entity) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Get neutral query builder for SELECT

**Kind**: instance method of [<code>L1Face</code>](#L1Face)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - associated instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| entity | <code>string</code> | <code>null</code> | table/view/etc. name |

<a name="L1Face+update"></a>

### l1Face.update(entity) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Get neutral query builder for UPDATE

**Kind**: instance method of [<code>L1Face</code>](#L1Face)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - associated instance  

| Param | Type | Description |
| --- | --- | --- |
| entity | <code>string</code> | table/view/etc. name |

<a name="L1Face+paramQuery"></a>

### l1Face.paramQuery(as, q, params)
Execute raw parametrized query

**Kind**: instance method of [<code>L1Face</code>](#L1Face)  
**Note**: Placeholders must be in form ":name"  
**Note**: see query() for results  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| q | <code>string</code> | raw query with placeholders |
| params | <code>object</code> | named parameters for replacement |

<a name="L1Face+associateResult"></a>

### l1Face.associateResult(as_result) ⇒ <code>array</code>
Convert raw result into array of associated rows (Maps)

**Kind**: instance method of [<code>L1Face</code>](#L1Face)  
**Returns**: <code>array</code> - Array of maps.  
**Note**: original result has "rows" as array of arrays and "fields" map  

| Param | Type | Description |
| --- | --- | --- |
| as_result | <code>object</code> | $as result of query() call |

<a name="L1Face.LATEST_VERSION"></a>

### L1Face.LATEST_VERSION
Latest supported FTN17 version

**Kind**: static property of [<code>L1Face</code>](#L1Face)  
<a name="L1Face.PING_VERSION"></a>

### L1Face.PING_VERSION
Latest supported FTN4 version

**Kind**: static property of [<code>L1Face</code>](#L1Face)  
<a name="L1Face.register"></a>

### L1Face.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>L1Face</code>](#L1Face)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | interface version to use |

<a name="L1Service"></a>

## L1Service
Base for Level 1 Database service implementation

**Kind**: global class  
<a name="L1Service.register"></a>

### L1Service.register(as, executor, options) ⇒ [<code>L1Service</code>](#L1Service)
Register futoin.db.l1 interface with Executor

**Kind**: static method of [<code>L1Service</code>](#L1Service)  
**Returns**: [<code>L1Service</code>](#L1Service) - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | options to pass to constructor |
| options.host | <code>string</code> | database host |
| options.port | <code>string</code> | database port |
| options.database | <code>string</code> | database name |
| options.user | <code>string</code> | database user |
| options.password | <code>string</code> | database password |
| options.conn_limit | <code>string</code> | max connections |

<a name="XferQuery"></a>

## XferQuery
**Kind**: global class  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| q | <code>string</code> | raw query |
| affected | <code>interger</code> \| <code>boolean</code> \| <code>null</code> | expected count of rows to be affected |
| selected | <code>interger</code> \| <code>boolean</code> \| <code>null</code> | expected count of rows to be selected |
| result | <code>boolean</code> \| <code>null</code> | mark to return result in response |

<a name="L2Face"></a>

## L2Face
Level 2 Database Face

**Kind**: global class  

* [L2Face](#L2Face)
    * _instance_
        * [.READ_UNCOMMITTED](#L2Face+READ_UNCOMMITTED)
        * [.READ_COMMITTED](#L2Face+READ_COMMITTED)
        * [.REPEATABL_READ](#L2Face+REPEATABL_READ)
        * [.SERIALIZABLE](#L2Face+SERIALIZABLE)
        * [.xfer](#L2Face+xfer)
        * [.newXfer([iso_level])](#L2Face+newXfer) ⇒ [<code>XferBuilder</code>](#XferBuilder)
    * _static_
        * [.READ_UNCOMMITTED](#L2Face.READ_UNCOMMITTED)
        * [.READ_COMMITTED](#L2Face.READ_COMMITTED)
        * [.REPEATABL_READ](#L2Face.REPEATABL_READ)
        * [.SERIALIZABLE](#L2Face.SERIALIZABLE)
        * [.register(as, ccm, name, endpoint, [credentials], [options])](#L2Face.register)

<a name="L2Face+READ_UNCOMMITTED"></a>

### l2Face.READ_UNCOMMITTED
Read Uncomitted isolation level constant

**Kind**: instance property of [<code>L2Face</code>](#L2Face)  
<a name="L2Face+READ_COMMITTED"></a>

### l2Face.READ_COMMITTED
Read Comitted isolation level constant

**Kind**: instance property of [<code>L2Face</code>](#L2Face)  
<a name="L2Face+REPEATABL_READ"></a>

### l2Face.REPEATABL_READ
Repeatable Read isolation level constant

**Kind**: instance property of [<code>L2Face</code>](#L2Face)  
<a name="L2Face+SERIALIZABLE"></a>

### l2Face.SERIALIZABLE
Serializable

**Kind**: instance property of [<code>L2Face</code>](#L2Face)  
<a name="L2Face+xfer"></a>

### l2Face.xfer
Execute query list in transaction of specific isolation level

**Kind**: instance property of [<code>L2Face</code>](#L2Face)  

| Param | Type | Description |
| --- | --- | --- |
| query_list | <code>array</code> | list of XferQuery objects |
| isolation_level | <code>string</code> | isolation level |

<a name="L2Face+newXfer"></a>

### l2Face.newXfer([iso_level]) ⇒ [<code>XferBuilder</code>](#XferBuilder)
Get new transcation builder.

**Kind**: instance method of [<code>L2Face</code>](#L2Face)  
**Returns**: [<code>XferBuilder</code>](#XferBuilder) - transaction builder instance  
**See**

- L2Face#READ_UNCOMMITTED
- L2Face#READ_COMMITTED
- L2Face#REPEATABL_READ
- L2Face#SERIALIZABLE


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [iso_level] | <code>string</code> | <code>&quot;RC&quot;</code> | RU, RC, RR or SRL |

<a name="L2Face.READ_UNCOMMITTED"></a>

### L2Face.READ_UNCOMMITTED
Read Uncomitted isolation level constant

**Kind**: static property of [<code>L2Face</code>](#L2Face)  
<a name="L2Face.READ_COMMITTED"></a>

### L2Face.READ_COMMITTED
Read Comitted isolation level constant

**Kind**: static property of [<code>L2Face</code>](#L2Face)  
<a name="L2Face.REPEATABL_READ"></a>

### L2Face.REPEATABL_READ
Repeatable Read isolation level constant

**Kind**: static property of [<code>L2Face</code>](#L2Face)  
<a name="L2Face.SERIALIZABLE"></a>

### L2Face.SERIALIZABLE
Serializable

**Kind**: static property of [<code>L2Face</code>](#L2Face)  
<a name="L2Face.register"></a>

### L2Face.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>L2Face</code>](#L2Face)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | interface version to use |

<a name="L2Service"></a>

## L2Service
Base for Level 2 Database service implementation

**Kind**: global class  
<a name="L2Service.register"></a>

### L2Service.register(as, executor, options) ⇒ [<code>L2Service</code>](#L2Service)
Register futoin.db.l2 interface with Executor

**Kind**: static method of [<code>L2Service</code>](#L2Service)  
**Returns**: [<code>L2Service</code>](#L2Service) - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | options to pass to constructor |
| options.host | <code>string</code> | database host |
| options.port | <code>string</code> | database port |
| options.database | <code>string</code> | database name |
| options.user | <code>string</code> | database user |
| options.password | <code>string</code> | database password |
| options.conn_limit | <code>string</code> | max connections |

<a name="MySQLService"></a>

## MySQLService
MySQL service implementation for FutoIn Database interface.addEventListener()

**Kind**: global class  
**Note**: If host is localhost then 'socketPath' is from 'port' option.  
<a name="PostgreSQLService"></a>

## PostgreSQLService
PostgreSQL service implementation for FutoIn Database interface

**Kind**: global class  
<a name="Expression"></a>

## Expression
Wrapper for raw expression to prevent escaping

**Kind**: global class  
<a name="Expression+toString"></a>

### expression.toString() ⇒ <code>string</code>
Allows easy joining with raw query

**Kind**: instance method of [<code>Expression</code>](#Expression)  
**Returns**: <code>string</code> - as is  
<a name="Prepared"></a>

## Prepared
Interface for prepared statement execution

**Kind**: global class  

* [Prepared](#Prepared)
    * [.execute(as, [params])](#Prepared+execute)
    * [.executeAsync(as, [params])](#Prepared+executeAsync)

<a name="Prepared+execute"></a>

### prepared.execute(as, [params])
**Kind**: instance method of [<code>Prepared</code>](#Prepared)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | step interface |
| [params] | <code>object</code> | <code></code> | parameters to subsitute |

<a name="Prepared+executeAsync"></a>

### prepared.executeAsync(as, [params])
**Kind**: instance method of [<code>Prepared</code>](#Prepared)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | step interface |
| [params] | <code>object</code> | <code></code> | parameters to subsitute |

<a name="Helpers"></a>

## Helpers
Additional helpers interface

**Kind**: global class  
<a name="QueryBuilder"></a>

## QueryBuilder
Neutral query builder

**Kind**: global class  

* [QueryBuilder](#QueryBuilder)
    * [new QueryBuilder(qb_or_lface, db_type, type, entity)](#new_QueryBuilder_new)
    * _instance_
        * [.getDriver()](#QueryBuilder+getDriver) ⇒ <code>IDriver</code>
        * [.clone()](#QueryBuilder+clone) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.escape(value)](#QueryBuilder+escape) ⇒ <code>string</code>
        * [.identifier(name)](#QueryBuilder+identifier) ⇒ <code>string</code>
        * [.expr(expr)](#QueryBuilder+expr) ⇒ [<code>Expression</code>](#Expression)
        * [.param(name)](#QueryBuilder+param) ⇒ [<code>Expression</code>](#Expression)
        * [.helpers()](#QueryBuilder+helpers) ⇒ [<code>Helpers</code>](#Helpers)
        * [.get(fields, [value])](#QueryBuilder+get) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.getInsertID(field)](#QueryBuilder+getInsertID) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.newRow()](#QueryBuilder+newRow) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.set(field, [value])](#QueryBuilder+set) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.where(conditions, [value])](#QueryBuilder+where) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.having(conditions, [value])](#QueryBuilder+having) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.group(field_expr)](#QueryBuilder+group) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.order(field_expr, [ascending])](#QueryBuilder+order) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.limit(count, [offset])](#QueryBuilder+limit) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.join(type, entity, conditions)](#QueryBuilder+join) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.innerJoin(entity, conditions)](#QueryBuilder+innerJoin) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.leftJoin(entity, conditions)](#QueryBuilder+leftJoin) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.execute(as, unsafe_dml)](#QueryBuilder+execute)
        * [.executeAssoc(as, unsafe_dml)](#QueryBuilder+executeAssoc)
        * [.prepare(unsafe_dml)](#QueryBuilder+prepare) ⇒ <code>ExecPrepared</code>
    * _static_
        * [.IDriver](#QueryBuilder.IDriver)
        * [.SQLDriver](#QueryBuilder.SQLDriver)
        * [.Expression](#QueryBuilder.Expression)
        * [.Prepared](#QueryBuilder.Prepared)
        * [.Helpers](#QueryBuilder.Helpers)
        * [.addDriver(type, module)](#QueryBuilder.addDriver)
        * [.getDriver(type)](#QueryBuilder.getDriver) ⇒ <code>IDriver</code>

<a name="new_QueryBuilder_new"></a>

### new QueryBuilder(qb_or_lface, db_type, type, entity)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| qb_or_lface | [<code>QueryBuilder</code>](#QueryBuilder) \| [<code>L1Face</code>](#L1Face) |  | ref |
| db_type | <code>string</code> | <code>null</code> | type of driver |
| type | <code>string</code> | <code>null</code> | type of driver |
| entity | <code>string</code> \| <code>null</code> | <code>null</code> | primary target to operate on |

<a name="QueryBuilder+getDriver"></a>

### queryBuilder.getDriver() ⇒ <code>IDriver</code>
Get related QB driver

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: <code>IDriver</code> - actual implementation of query builder driver  
<a name="QueryBuilder+clone"></a>

### queryBuilder.clone() ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Get a copy of Query Builder

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - copy which can be processed independently  
<a name="QueryBuilder+escape"></a>

### queryBuilder.escape(value) ⇒ <code>string</code>
Escape value for embedding into raw query

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: <code>string</code> - driver-specific escape  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | value, array or sub-query to escape |

<a name="QueryBuilder+identifier"></a>

### queryBuilder.identifier(name) ⇒ <code>string</code>
Escape identifier for embedding into raw query

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: <code>string</code> - driver-specific escape  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | raw identifier to escape |

<a name="QueryBuilder+expr"></a>

### queryBuilder.expr(expr) ⇒ [<code>Expression</code>](#Expression)
Wrap raw expression to prevent escaping.

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>Expression</code>](#Expression) - wrapped expression  

| Param | Type | Description |
| --- | --- | --- |
| expr | <code>string</code> | expression to wrap |

<a name="QueryBuilder+param"></a>

### queryBuilder.param(name) ⇒ [<code>Expression</code>](#Expression)
Wrap parameter name to prevent escaping.

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>Expression</code>](#Expression) - wrapped expression  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | name to wrap |

<a name="QueryBuilder+helpers"></a>

### queryBuilder.helpers() ⇒ [<code>Helpers</code>](#Helpers)
Get additional helpers

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>Helpers</code>](#Helpers) - - db-specific helpers object  
<a name="QueryBuilder+get"></a>

### queryBuilder.get(fields, [value]) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Set fields to retrieve.

Can be called multiple times for appending.

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  
**P**: fields can be a Map or object:
- keys are field names as is
- values - any expression which is not being escaped automatically  
**P**: fields can be a list of field names (array)
- values - field names  
**P**: fields can be a single string
- optional @p value is expresion

Value can be another QueryBuilder instance.  

| Param | Type | Description |
| --- | --- | --- |
| fields | <code>Map</code> \| <code>object</code> \| <code>string</code> \| <code>array</code> | see concept for details |
| [value] | <code>\*</code> | optional value for |

<a name="QueryBuilder+getInsertID"></a>

### queryBuilder.getInsertID(field) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Database neutral way to request last insert ID

For databases without RETURNING or OUTPUT clause in INSERT it
is expected to always return '$id' field on insert.

For others, it would build a valid RETURNING/OUTPUT clause.

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  

| Param | Type | Description |
| --- | --- | --- |
| field | <code>string</code> | field name with auto-generated value |

<a name="QueryBuilder+newRow"></a>

### queryBuilder.newRow() ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Save current set() context and start new INSERT row

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  
<a name="QueryBuilder+set"></a>

### queryBuilder.set(field, [value]) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Add fields to set in UPDATE query.

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  
**P**: fields can be Map or object to setup multiple fields at once.
- keys - key name as is, no escape
- value - any value to be escaped or QueryBuilder instance

Single field => value can be used as shortcut for object form.  

| Param | Type | Description |
| --- | --- | --- |
| field | <code>Map</code> \| <code>object</code> \| <code>string</code> | field(s) to assign |
| [value] | <code>string</code> \| <code>number</code> \| <code>null</code> \| [<code>QueryBuilder</code>](#QueryBuilder) | value to assign |

<a name="QueryBuilder+where"></a>

### queryBuilder.where(conditions, [value]) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Control "WHERE" part

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  

| Param | Type | Description |
| --- | --- | --- |
| conditions | <code>\*</code> | constraints to add |
| [value] | <code>\*</code> | optional value for single field |

<a name="QueryBuilder+having"></a>

### queryBuilder.having(conditions, [value]) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Control "HAVING" part

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  
**See**: QueryBuilder.where  

| Param | Type | Description |
| --- | --- | --- |
| conditions | <code>\*</code> | constraints to add |
| [value] | <code>\*</code> | optional value for single field |

<a name="QueryBuilder+group"></a>

### queryBuilder.group(field_expr) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Append group by

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  

| Param | Type | Description |
| --- | --- | --- |
| field_expr | <code>string</code> | field or expressions |

<a name="QueryBuilder+order"></a>

### queryBuilder.order(field_expr, [ascending]) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Append order by

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| field_expr | <code>string</code> |  | field or expressions |
| [ascending] | <code>Boolean</code> | <code>true</code> | ascending sorting, if true |

<a name="QueryBuilder+limit"></a>

### queryBuilder.limit(count, [offset]) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Limit query output

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  
**Note**: if @p count is omitted then @p start is used as count!  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| count | <code>integer</code> |  | size |
| [offset] | <code>integer</code> | <code>0</code> | offset |

<a name="QueryBuilder+join"></a>

### queryBuilder.join(type, entity, conditions) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Add "JOIN" part

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  
**See**: QueryBuilder.where  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | e.g. INNER, LEFT |
| entity | <code>string</code> \| <code>array</code> | fornat is the same as of QueryBuilder |
| conditions | <code>\*</code> | constraints to add |

<a name="QueryBuilder+innerJoin"></a>

### queryBuilder.innerJoin(entity, conditions) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Add "INNER JOIN"

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  
**See**: QueryBuilder.where  

| Param | Type | Description |
| --- | --- | --- |
| entity | <code>string</code> \| <code>array</code> | fornat is the same as of QueryBuilder |
| conditions | <code>\*</code> | constraints to add |

<a name="QueryBuilder+leftJoin"></a>

### queryBuilder.leftJoin(entity, conditions) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
Add "LEFT JOIN"

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>QueryBuilder</code>](#QueryBuilder) - self  
**See**: QueryBuilder.where  

| Param | Type | Description |
| --- | --- | --- |
| entity | <code>string</code> \| <code>array</code> | fornat is the same as of QueryBuilder |
| conditions | <code>\*</code> | constraints to add |

<a name="QueryBuilder+execute"></a>

### queryBuilder.execute(as, unsafe_dml)
Complete query and execute through associated interface.

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**See**: L1Face.query  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| unsafe_dml | <code>Boolean</code> | <code>false</code> | raise error, if DML without conditions |

<a name="QueryBuilder+executeAssoc"></a>

### queryBuilder.executeAssoc(as, unsafe_dml)
Complete query and execute through associated interface.

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**See**

- L1Face.query
- L1Face.associateResult


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| unsafe_dml | <code>Boolean</code> | <code>false</code> | raise error, if DML without conditions |

<a name="QueryBuilder+prepare"></a>

### queryBuilder.prepare(unsafe_dml) ⇒ <code>ExecPrepared</code>
Prepare statement for efficient execution multiple times

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: <code>ExecPrepared</code> - closue with prepared statement  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| unsafe_dml | <code>Boolean</code> | <code>false</code> | raise error, if DML without conditions |

<a name="QueryBuilder.IDriver"></a>

### QueryBuilder.IDriver
Base for QB Driver implementation

**Kind**: static property of [<code>QueryBuilder</code>](#QueryBuilder)  
<a name="QueryBuilder.SQLDriver"></a>

### QueryBuilder.SQLDriver
Base for SQL-based QB Driver implementation

**Kind**: static property of [<code>QueryBuilder</code>](#QueryBuilder)  
<a name="QueryBuilder.Expression"></a>

### QueryBuilder.Expression
Wrapper for raw expressions

**Kind**: static property of [<code>QueryBuilder</code>](#QueryBuilder)  
<a name="QueryBuilder.Prepared"></a>

### QueryBuilder.Prepared
Interface of Prepared statement

**Kind**: static property of [<code>QueryBuilder</code>](#QueryBuilder)  
<a name="QueryBuilder.Helpers"></a>

### QueryBuilder.Helpers
Interface of Helpers

**Kind**: static property of [<code>QueryBuilder</code>](#QueryBuilder)  
<a name="QueryBuilder.addDriver"></a>

### QueryBuilder.addDriver(type, module)
Register query builder driver implementation

**Kind**: static method of [<code>QueryBuilder</code>](#QueryBuilder)  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | type of driver |
| module | <code>IDriver</code> \| <code>function</code> \| <code>string</code> \| <code>object</code> | implementation |

<a name="QueryBuilder.getDriver"></a>

### QueryBuilder.getDriver(type) ⇒ <code>IDriver</code>
Get implementation of previously registered driver

**Kind**: static method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: <code>IDriver</code> - actual implementation of query builder driver  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | type of driver |

<a name="SQLiteService"></a>

## SQLiteService
SQLite service implementation for FutoIn Database interface.addEventListener()

**Kind**: global class  
<a name="new_SQLiteService_new"></a>

### new SQLiteService(options)
Please use SQLiteService.register() for proper setup.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>object</code> |  | see SQLiteService.register() for common options |
| [options.raw] | <code>objecT</code> | <code>{}</code> | raw options |
| [options.raw.filename] | <code>string</code> | <code>&quot;options.port&quot;</code> | database file |
| [options.raw.mode] | <code>integer</code> | <code>OPEN_READWRITE|OPEN_CREATE|SQLITE_OPEN_FULLMUTEX</code> | open mode |
| [options.raw.busyTimeout] | <code>integer</code> | <code>10000</code> | busyTimeout configuration value |
| [options.raw.pragma] | <code>array</code> | <code>[]</code> | list of pragma statements to execute on DB open |

<a name="QueryOptions"></a>

## QueryOptions
**Kind**: global class  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| affected | <code>integer</code> \| <code>boolean</code> \| <code>null</code> | affected rows constaint |
| selected | <code>integer</code> \| <code>boolean</code> \| <code>null</code> | selected rows constaint |
| return | <code>boolean</code> \| <code>null</code> | return result in response |

<a name="XferQueryBuilder"></a>

## XferQueryBuilder
Version of QueryBuilder which forbids direct execution.

**Kind**: global class  

* [XferQueryBuilder](#XferQueryBuilder)
    * [.backref(xqb, field, [multi])](#XferQueryBuilder+backref) ⇒ [<code>Expression</code>](#Expression)
    * [.forUpdate()](#XferQueryBuilder+forUpdate) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
    * [.forSharedRead()](#XferQueryBuilder+forSharedRead) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)

<a name="XferQueryBuilder+backref"></a>

### xferQueryBuilder.backref(xqb, field, [multi]) ⇒ [<code>Expression</code>](#Expression)
Get transaction back reference expression

**Kind**: instance method of [<code>XferQueryBuilder</code>](#XferQueryBuilder)  
**Returns**: [<code>Expression</code>](#Expression) - with DB-specific escape sequence  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| xqb | [<code>XferQueryBuilder</code>](#XferQueryBuilder) |  | any previous transaction      query builder instances. |
| field | <code>string</code> |  | field to reference by name |
| [multi] | <code>boolean</code> | <code>false</code> | reference single result row or multiple |

<a name="XferQueryBuilder+forUpdate"></a>

### xferQueryBuilder.forUpdate() ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
Mark select FOR UPDATE

**Kind**: instance method of [<code>XferQueryBuilder</code>](#XferQueryBuilder)  
**Returns**: [<code>XferQueryBuilder</code>](#XferQueryBuilder) - self  
<a name="XferQueryBuilder+forSharedRead"></a>

### xferQueryBuilder.forSharedRead() ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
Mark select FOR SHARED READ

**Kind**: instance method of [<code>XferQueryBuilder</code>](#XferQueryBuilder)  
**Returns**: [<code>XferQueryBuilder</code>](#XferQueryBuilder) - self  
<a name="XferBuilder"></a>

## XferBuilder
Transction builder.

Overall concept is build inividual queries to be executed without delay.
It's possible to add result constraints to each query for intermediate checks:
- affected - integer or boolean to check DML result
- selected - integer or boolean to check DQL result
- result - mark query result to be returned in response list

**Kind**: global class  

* [XferBuilder](#XferBuilder)
    * [.clone()](#XferBuilder+clone) ⇒ [<code>XferBuilder</code>](#XferBuilder)
    * [.getDriver()](#XferBuilder+getDriver) ⇒ <code>IDriver</code>
    * [.escape(value)](#XferBuilder+escape) ⇒ <code>string</code>
    * [.identifier(name)](#XferBuilder+identifier) ⇒ <code>string</code>
    * [.expr(expr)](#XferBuilder+expr) ⇒ [<code>Expression</code>](#Expression)
    * [.param(name)](#XferBuilder+param) ⇒ [<code>Expression</code>](#Expression)
    * [.helpers()](#XferBuilder+helpers) ⇒ [<code>Helpers</code>](#Helpers)
    * [.query(type, entity, [query_options])](#XferBuilder+query) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
    * [.delete(entity, [query_options])](#XferBuilder+delete) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
    * [.insert(entity, [query_options])](#XferBuilder+insert) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
    * [.update(entity, [query_options])](#XferBuilder+update) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
    * [.select(entity, [query_options])](#XferBuilder+select) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
    * [.call(name, [args], [query_options])](#XferBuilder+call)
    * [.raw(q, [params], [query_options])](#XferBuilder+raw)
    * [.execute(as, unsafe_dml)](#XferBuilder+execute)
    * [.executeAssoc(as, unsafe_dml)](#XferBuilder+executeAssoc)
    * [.prepare(unsafe_dml)](#XferBuilder+prepare) ⇒ <code>ExecPrepared</code>

<a name="XferBuilder+clone"></a>

### xferBuilder.clone() ⇒ [<code>XferBuilder</code>](#XferBuilder)
Get a copy of XferBuilder for independent processing.

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: [<code>XferBuilder</code>](#XferBuilder) - transaction builder instance  
<a name="XferBuilder+getDriver"></a>

### xferBuilder.getDriver() ⇒ <code>IDriver</code>
Get related QV driver

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: <code>IDriver</code> - actual implementation of query builder driver  
<a name="XferBuilder+escape"></a>

### xferBuilder.escape(value) ⇒ <code>string</code>
Escape value for embedding into raw query

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: <code>string</code> - driver-specific escape  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | value, array or sub-query to escape |

<a name="XferBuilder+identifier"></a>

### xferBuilder.identifier(name) ⇒ <code>string</code>
Escape identifier for embedding into raw query

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: <code>string</code> - driver-specific escape  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | raw identifier to escape |

<a name="XferBuilder+expr"></a>

### xferBuilder.expr(expr) ⇒ [<code>Expression</code>](#Expression)
Wrap raw expression to prevent escaping.

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: [<code>Expression</code>](#Expression) - wrapped expression  

| Param | Type | Description |
| --- | --- | --- |
| expr | <code>string</code> | expression to wrap |

<a name="XferBuilder+param"></a>

### xferBuilder.param(name) ⇒ [<code>Expression</code>](#Expression)
Wrap parameter name to prevent escaping.

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: [<code>Expression</code>](#Expression) - wrapped expression  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | name to wrap |

<a name="XferBuilder+helpers"></a>

### xferBuilder.helpers() ⇒ [<code>Helpers</code>](#Helpers)
Get additional helpers

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: [<code>Helpers</code>](#Helpers) - - db-specific helpers object  
<a name="XferBuilder+query"></a>

### xferBuilder.query(type, entity, [query_options]) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
Get generic query builder

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: [<code>XferQueryBuilder</code>](#XferQueryBuilder) - individual query builder instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| type | <code>string</code> |  | query type |
| entity | <code>string</code> \| <code>null</code> |  | man subject |
| [query_options] | [<code>QueryOptions</code>](#QueryOptions) | <code>{}</code> | constraints |

<a name="XferBuilder+delete"></a>

### xferBuilder.delete(entity, [query_options]) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
Get DELETE query builder

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: [<code>XferQueryBuilder</code>](#XferQueryBuilder) - individual query builder instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| entity | <code>string</code> \| <code>null</code> |  | man subject |
| [query_options] | [<code>QueryOptions</code>](#QueryOptions) | <code>{}</code> | constraints |

<a name="XferBuilder+insert"></a>

### xferBuilder.insert(entity, [query_options]) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
Get INSERT query builder

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: [<code>XferQueryBuilder</code>](#XferQueryBuilder) - individual query builder instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| entity | <code>string</code> \| <code>null</code> |  | man subject |
| [query_options] | [<code>QueryOptions</code>](#QueryOptions) | <code>{}</code> | constraints |

<a name="XferBuilder+update"></a>

### xferBuilder.update(entity, [query_options]) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
Get UPDATE query builder

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: [<code>XferQueryBuilder</code>](#XferQueryBuilder) - individual query builder instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| entity | <code>string</code> \| <code>null</code> |  | man subject |
| [query_options] | [<code>QueryOptions</code>](#QueryOptions) | <code>{}</code> | constraints |

<a name="XferBuilder+select"></a>

### xferBuilder.select(entity, [query_options]) ⇒ [<code>XferQueryBuilder</code>](#XferQueryBuilder)
Get SELECT query builder

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: [<code>XferQueryBuilder</code>](#XferQueryBuilder) - individual query builder instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| entity | <code>string</code> \| <code>null</code> |  | man subject |
| [query_options] | [<code>QueryOptions</code>](#QueryOptions) | <code>{}</code> | constraints |

<a name="XferBuilder+call"></a>

### xferBuilder.call(name, [args], [query_options])
Add CALL query

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | stored procedure name |
| [args] | <code>array</code> | <code>[]</code> | positional arguments |
| [query_options] | [<code>QueryOptions</code>](#QueryOptions) | <code>{}</code> | constraints |

<a name="XferBuilder+raw"></a>

### xferBuilder.raw(q, [params], [query_options])
Execute raw query

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Note**: Pass null in {@p params}, if you want to use prepare()  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| q | <code>string</code> |  | raw query |
| [params] | <code>object</code> | <code></code> | named argument=>value pairs |
| [query_options] | [<code>QueryOptions</code>](#QueryOptions) | <code>{}</code> | constraints |

<a name="XferBuilder+execute"></a>

### xferBuilder.execute(as, unsafe_dml)
Complete query and execute through associated interface.

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**See**: L1Face.query  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| unsafe_dml | <code>Boolean</code> | <code>false</code> | raise error, if DML without conditions |

<a name="XferBuilder+executeAssoc"></a>

### xferBuilder.executeAssoc(as, unsafe_dml)
Complete query and execute through associated interface.

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**See**

- L1Face.query
- L1Face.associateResult


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| unsafe_dml | <code>Boolean</code> | <code>false</code> | raise error, if DML without conditions |

<a name="XferBuilder+prepare"></a>

### xferBuilder.prepare(unsafe_dml) ⇒ <code>ExecPrepared</code>
Prepare statement for efficient execution multiple times

**Kind**: instance method of [<code>XferBuilder</code>](#XferBuilder)  
**Returns**: <code>ExecPrepared</code> - closue with prepared statement  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| unsafe_dml | <code>Boolean</code> | <code>false</code> | raise error, if DML without conditions |

<a name="AutoConfig"></a>

## AutoConfig
**Kind**: global variable  
**Brief**: Automatically configure database connections 
       and related internal Executors.

For each config entry an instance of dedicated
Executor with registered database service is created and
related interface is registered on CCM.

Interfaces are registered as "#db.{key}". The "default" one
is also aliased as "#db".

Env patterns to service configuration:
- DB_{name}_HOST -> host
- DB_{name}_PORT -> port
- DB_{name}_SOCKET -> port (overrides DB_PORT)
- DB_{name}_USER -> user
- DB_{name}_PASS -> password
- DB_{name}_DB -> database
- DB_{name}_MAXCONN -> conn_limit
- DB_{name}_TYPE - type of database, fails if mismatch configuration
Note: the variables names are driven by CodingFuture CFDB Puppet module.

The "default" key also tries env without "{name}_" infix.

Example:
```javascript
 AutoConfig(ccm, {
     "default": {
         type: ["mysql", "postgresql"],
         // DB_DEFAULT_TYPE or DB_TYPE must match any of them
     },
     readonly: {
         type: "mysql"
         // fail, if DB_READONLY_TYPE != mysql
     },
     preset: {
         type: "postgresql",
         host: "127.0.0.1",
         port: 5432,
         user: "test",
         password: "test",
         database: "test",
         conn_limit: 10,
         // no need to env variables - all is preset
     },
 })
```  
**Note**: it also monkey patches CCM with #db(name="default") method  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | async steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| [config] | <code>object</code> | <code></code> | expected connection key => type map |
| [env] | <code>object</code> | <code>process.env</code> | source of settings |

<a name="AutoConfig.register"></a>

### AutoConfig.register
Register database service type.

**Kind**: static property of [<code>AutoConfig</code>](#AutoConfig)  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | type of database |
| factory | <code>string</code> \| <code>callable</code> \| <code>object</code> | module name, factory method      or a subclass of L1Service |

<a name="now"></a>

## now() ⇒ [<code>Expression</code>](#Expression)
Get DB-specific current timestamp expression

**Kind**: global function  
**Returns**: [<code>Expression</code>](#Expression) - - current timestamp  
<a name="date"></a>

## date(value) ⇒ [<code>Expression</code>](#Expression)
Convert native timestamp to DB format

**Kind**: global function  
**Returns**: [<code>Expression</code>](#Expression) - - timestamp in DB format  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>moment</code> \| <code>string</code> | native timestamp |

<a name="nativeDate"></a>

## nativeDate(value) ⇒ <code>moment</code>
Convert DB timestamp to native format

**Kind**: global function  
**Returns**: <code>moment</code> - - timestamp in moment.js  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>string</code> | timestamp in DB format |

<a name="dateModify"></a>

## dateModify(expr, seconds) ⇒ [<code>Expression</code>](#Expression)
Create expression representing date modification of
input expression by specified number of seconds.

**Kind**: global function  
**Returns**: [<code>Expression</code>](#Expression) - - DB expression  

| Param | Type | Description |
| --- | --- | --- |
| expr | [<code>Expression</code>](#Expression) \| <code>string</code> | source expression (e.g field name) |
| seconds | <code>seconds</code> | number of seconds to add/subtract(negative) |



*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


