
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

TBD.


# Installation for Node.js

Command line:
```sh
$ npm install futoin-database --save
```

# Examples

TBD.
    
# API documentation

The concept is described in FutoIn specification: [FTN17: FutoIn Interface - Database v1.x](http://specs.futoin.org/draft/preview/ftn17_if_database-1.html)

## Classes

<dl>
<dt><a href="#L1Face">L1Face</a></dt>
<dd><p>Level 1 Database Face</p>
</dd>
<dt><a href="#L2Face">L2Face</a></dt>
<dd><p>Level 2 Database Face</p>
</dd>
<dt><a href="#Expression">Expression</a></dt>
<dd><p>Wrapper for raw expression to prevent escaping of them</p>
</dd>
<dt><a href="#IDriver">IDriver</a></dt>
<dd><p>Basic interface for DB flavour support</p>
</dd>
<dt><a href="#SQLDriver">SQLDriver</a></dt>
<dd><p>Basic logic for SQL-based databases</p>
</dd>
<dt><a href="#QueryBuilder">QueryBuilder</a></dt>
<dd><p>Neutral query builder</p>
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

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | Type of query: SELECT, INSERT, UPDATE, DELETE, ... |
| entity | <code>string</code> | table/view/etc. name |

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

| Param | Type | Description |
| --- | --- | --- |
| entity | <code>string</code> | table/view/etc. name |

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

<a name="L2Face"></a>

## L2Face
Level 2 Database Face

**Kind**: global class  
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

<a name="Expression"></a>

## Expression
Wrapper for raw expression to prevent escaping of them

**Kind**: global class  
<a name="IDriver"></a>

## IDriver
Basic interface for DB flavour support

**Kind**: global class  
<a name="SQLDriver"></a>

## SQLDriver
Basic logic for SQL-based databases

**Kind**: global class  
<a name="QueryBuilder"></a>

## QueryBuilder
Neutral query builder

**Kind**: global class  

* [QueryBuilder](#QueryBuilder)
    * [new QueryBuilder(qb_or_lface, db_type, type, entity)](#new_QueryBuilder_new)
    * _instance_
        * [.getDriver()](#QueryBuilder+getDriver) ⇒ [<code>IDriver</code>](#IDriver)
        * [.clone()](#QueryBuilder+clone) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
        * [.escape(value)](#QueryBuilder+escape) ⇒ <code>string</code>
        * [.identifier(name)](#QueryBuilder+identifier) ⇒ <code>string</code>
        * [.raw(expr)](#QueryBuilder+raw) ⇒ [<code>Expression</code>](#Expression)
        * [.get(fields, [value])](#QueryBuilder+get) ⇒ [<code>QueryBuilder</code>](#QueryBuilder)
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
    * _static_
        * [.IDriver](#QueryBuilder.IDriver)
        * [.SQLDriver](#QueryBuilder.SQLDriver)
        * [.Expression](#QueryBuilder.Expression)
        * [.addDriver(type, module)](#QueryBuilder.addDriver)
        * [.getDriver(type)](#QueryBuilder.getDriver) ⇒ [<code>IDriver</code>](#IDriver)

<a name="new_QueryBuilder_new"></a>

### new QueryBuilder(qb_or_lface, db_type, type, entity)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| qb_or_lface | [<code>QueryBuilder</code>](#QueryBuilder) \| [<code>L1Face</code>](#L1Face) |  | ref |
| db_type | <code>string</code> | <code>null</code> | type of driver |
| type | <code>string</code> | <code>null</code> | type of driver |
| entity | <code>string</code> \| <code>null</code> | <code>null</code> | primary target to operate on |

<a name="QueryBuilder+getDriver"></a>

### queryBuilder.getDriver() ⇒ [<code>IDriver</code>](#IDriver)
Get related QB driver

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>IDriver</code>](#IDriver) - actual implementation of query builder driver  
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

<a name="QueryBuilder+raw"></a>

### queryBuilder.raw(expr) ⇒ [<code>Expression</code>](#Expression)
Wrap raw expression to prevent escaping.

**Kind**: instance method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>Expression</code>](#Expression) - wrapped expression  

| Param | Type | Description |
| --- | --- | --- |
| expr | <code>string</code> | expression to wrap |

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
<a name="QueryBuilder.addDriver"></a>

### QueryBuilder.addDriver(type, module)
Register query builder driver implementation

**Kind**: static method of [<code>QueryBuilder</code>](#QueryBuilder)  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | type of driver |
| module | [<code>IDriver</code>](#IDriver) \| <code>function</code> \| <code>string</code> \| <code>object</code> | implementation |

<a name="QueryBuilder.getDriver"></a>

### QueryBuilder.getDriver(type) ⇒ [<code>IDriver</code>](#IDriver)
Get implementation of previously registered driver

**Kind**: static method of [<code>QueryBuilder</code>](#QueryBuilder)  
**Returns**: [<code>IDriver</code>](#IDriver) - actual implementation of query builder driver  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | type of driver |



*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


