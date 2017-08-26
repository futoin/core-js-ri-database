
  [![NPM Version](https://img.shields.io/npm/v/futoin-database.svg?style=flat)](https://www.npmjs.com/package/futoin-database)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-database.svg?style=flat)](https://www.npmjs.com/package/futoin-database)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-database.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-database)
  [![stable](https://img.shields.io/badge/stability-stable-green.svg?style=flat)](https://www.npmjs.com/package/futoin-asyncsteps)

  [![NPM](https://nodei.co/npm/futoin-database.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-database/)

# FutoIn reference implementation

Reference implementation of:
 
    FTN17: FutoIn Interface - Database
    Version: 1.0DV
    
* Spec: [FTN17: FutoIn Interface - Database v1.x](http://specs.futoin.org/draft/preview/ftn17_if_database-1.html)

[Web Site](http://futoin.org/)

# About

Database neutral microservice interface with advanced Query and revolutionary Transaction builder.

Auto-configuration based on process environment variables and connection pooling by design.

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
native DB query. Such pattern avoids blocking on usually expensive DB connection
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

# Implementation details

## Auto-configuration

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

## Insert ID

It's a known painful moment in many abstractions. For databases like
MySQL last insert ID is always "selected" as special `$id` result field.

For `QueryBuilder` abstraction please use `getInsertID(id_field)` call
for cross-database compatibility.

## Conditions

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
        
## Sub-queries

Everywhere specific database implementation allows sub-queries, they can be used:

1. As select or join entity - alias must be provided in array format:
    - `[QueryBuilder(), 'Alias']`
2. As any condition value part, except raw strings
3. As expression for .get(alias, expr) calls


# Examples

## 1. Raw queries

```javascript
/**
 * Process ENV options:
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

```

## 4. Simple Transaction Builder

```javascript

```

## 5. Efficient Transaction Builder (prepared)

```javascript

```

## 6. Advanced Transaction Builder

```javascript

```

## 7. Multiple connection types

```javascript

```
    
# API documentation

The concept is described in FutoIn specification: [FTN17: FutoIn Interface - Database v1.x](http://specs.futoin.org/draft/preview/ftn17_if_database-1.html)

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
<dt><a href="#QueryBuilder">QueryBuilder</a></dt>
<dd><p>Neutral query builder</p>
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
        * [.get(fields, [value])](#QueryBuilder+get) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.getInsertID(field)](#QueryBuilder+getInsertID) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
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



*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


