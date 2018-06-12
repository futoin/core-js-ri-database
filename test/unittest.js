'use strict';

require( './prepare' );

const expect = require( 'chai' ).expect;
const $as = require( 'futoin-asyncsteps' );

const { QueryBuilder } = require( '../main' );

class MockSQLHelpers extends QueryBuilder.SQLHelpers {
    _escapeSimple( value ) {
        switch ( typeof value ) {
        case 'boolean':
            return value ? 'TRUE' : 'FALSE';

        case 'string':
            return `^${value.replace( /\\/g, '\\\\' ).replace( /\^/g, '\\^' )}^`;

        case 'number':
            return `${value}`;

        default:
            if ( value === null ) {
                return 'NULL';
            }

            if ( value instanceof QueryBuilder.Expression ) {
                return value.toQuery();
            }

            throw new Error( `Unknown type: ${typeof value}` );
        }
    }
}

class MockSQLDriver extends QueryBuilder.SQLDriver {
    constructor() {
        super( new MockSQLHelpers );
    }
}

describe( 'QueryBuilder', function() {
    const L1Face = require( '../L1Face' );

    const mockFace = new class extends L1Face {
        constructor() {
            super(
                { limiters: {} },
                { funcs: {},
                    options: {} } );
            this._result = null;
            this._db_type = 'mocksql';
        }

        query( as, q ) {
            if ( typeof as === 'function' ) {
                as( q );
            } else {
                as.add( ( as ) => {
                    as.success( this._result );
                } );
            }
        }
    };

    QueryBuilder.addDriver( 'mocksql', new MockSQLDriver );

    const genQB = ( type, entity='Table' ) => {
        return mockFace.queryBuilder( type, entity );
    };

    beforeEach( function() {
        mockFace._db_type = 'mocksql';
        mockFace._result = {
            rows: [ [ 1, 'aaa' ], [ 2, 'bb' ], [ 3, 'c' ] ],
            fields: [ 'id', 'name' ],
            affected: 123,
        };
    } );


    describe( 'DELETE', function() {
        it( 'should generate simple statement', function() {
            let qb = genQB( 'delete' );
            let res = qb._toQuery();
            expect( res ).to.equal( 'DELETE FROM Table' );
            expect( res ).to.equal( `${qb}` );
        } );

        it( 'should generate conditional statement', function() {
            let qb = genQB( 'dELEte' );
            let res = qb.where( 'val IS NULL' )._toQuery();
            expect( res ).to.equal( 'DELETE FROM Table WHERE val IS NULL' );
        } );

        it( 'should detect invalid queries', function() {
            let qb = genQB( 'delete' );

            expect( () => {
                genQB( 'delete', null )._toQuery();
            } ).to.throw( 'Entity is not set' );

            expect( () => {
                qb.clone().where( 'val IS NULL' ).get( 'f' )._toQuery();
            } ).to.throw( 'Unused map "select"' );

            expect( () => {
                qb.clone().where( 'val IS NULL' ).set( 'f', 'a' )._toQuery();
            } ).to.throw( 'Unused map "toset"' );

            expect( () => {
                qb.clone().where( 'val IS NULL' ).group( 'expr' )._toQuery();
            } ).to.throw( 'Unused array "group"' );

            expect( () => {
                qb.clone().where( 'val IS NULL' ).having( 'expr' )._toQuery();
            } ).to.throw( 'Unused array "having"' );

            expect( () => {
                qb.clone().where( 'val IS NULL' ).order( 'expr' )._toQuery();
            } ).to.throw( 'Unused array "order"' );

            expect( () => {
                qb.clone().where( 'val IS NULL' ).limit( 10 )._toQuery();
            } ).to.throw( 'Unused array "limit"' );

            expect( () => {
                qb.clone().where( 'val IS NULL' ).leftJoin( 'Other' )._toQuery();
            } ).to.throw( 'Unused array "joins"' );
        } );
    } );

    describe( 'INSERT', function() {
        it( 'should generate simple statement', function() {
            let qb = genQB( 'insert' );
            let res = qb.set( 'a', 'b' )._toQuery();
            expect( res ).to.equal( 'INSERT INTO Table (a) VALUES (^b^)' );

            res = qb.set( 'a', 'b' ).set( { d: 'D',
                c: 'C' } )._toQuery();
            expect( res ).to.equal( 'INSERT INTO Table (a,d,c) VALUES (^b^,^D^,^C^)' );
        } );

        it( 'should generate complex statement', function() {
            let qb = genQB( 'inSeRt' );
            let res = qb.set( 'a', qb.expr( 'A + B' ) )._toQuery();
            expect( res ).to.equal( 'INSERT INTO Table (a) VALUES (A + B)' );

            res = qb.set( 'b', genQB( 'select', 'Other' ) )._toQuery();
            expect( res ).to.equal(
                'INSERT INTO Table (a,b) ' +
                'VALUES (A + B,(SELECT * FROM Other))' );
        } );

        it( 'should generate INSERT-SELECT statement', function() {
            let sqb = genQB( 'select', 'Other' );
            sqb.get( { a: 'A',
                b: 'B' } );
            let res = genQB( 'insert' ).set( sqb )._toQuery();
            expect( res ).to.equal(
                'INSERT INTO Table (a,b) '+
                'SELECT A AS a,B AS b FROM Other' );
        } );

        it( 'should generate INSERT multi-row statement', function() {
            let res = genQB( 'insert' )
                .set( { a: 1,
                    b: 2 } )
                .newRow().set( { a: 2,
                    b: 3 } )
                .newRow().set( { a: 5,
                    b: 10 } )
                ._toQuery();
            expect( res ).to.equal(
                'INSERT INTO Table (a,b) '+
                'VALUES (1,2),(2,3),(5,10)' );

            res = genQB( 'insert' )
                .newRow().set( { a: 1,
                    b: 2 } )
                .newRow().set( { a: 2,
                    b: 3 } )
                .newRow().set( { a: 5,
                    b: 10 } )
                ._toQuery();
            expect( res ).to.equal(
                'INSERT INTO Table (a,b) '+
                'VALUES (1,2),(2,3),(5,10)' );

            res = genQB( 'insert' )
                .newRow().set( { a: 1,
                    b: 2 } )
                .newRow().set( { a: 2,
                    b: 3 } )
                .newRow().set( { a: 5,
                    b: 10 } )
                .newRow()
                ._toQuery();
            expect( res ).to.equal(
                'INSERT INTO Table (a,b) '+
                'VALUES (1,2),(2,3),(5,10)' );
        } );

        it( 'should detect invalid queries', function() {
            let qb = genQB( 'insert' );

            expect( () => {
                genQB( 'insert', null )._toQuery();
            } ).to.throw( 'Entity is not set' );

            expect( () => {
                qb.clone()._toQuery();
            } ).to.throw( 'Nothing to set' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).get( 'f' )._toQuery();
            } ).to.throw( 'Unused map "select"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).where( { f: 'a' } )._toQuery();
            } ).to.throw( 'Unused array "where"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).group( 'expr' )._toQuery();
            } ).to.throw( 'Unused array "group"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).having( 'expr' )._toQuery();
            } ).to.throw( 'Unused array "having"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).order( 'expr' )._toQuery();
            } ).to.throw( 'Unused array "order"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).limit( 10 )._toQuery();
            } ).to.throw( 'Unused array "limit"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).leftJoin( 'Other' )._toQuery();
            } ).to.throw( 'Unused array "joins"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).set( genQB( 'select' ) )._toQuery();
            } ).to.throw( 'INSERT-SELECT can not be mixed with others' );

            expect( () => {
                qb.clone().set( genQB( 'select' ) ).set( 'a', 'A' )._toQuery();
            } ).to.throw( 'INSERT-SELECT can not be mixed with others' );

            expect( () => {
                qb.clone().set( genQB( 'delete' ) )._toQuery();
            } ).to.throw( 'Not a SELECT sub-query' );

            expect( () => {
                qb.clone().set( { a:1,
                    b:2 } )
                    .newRow().set( { a:1,
                        b:2,
                        c:3 } )._toQuery();
            } ).to.throw( 'Multi-row field count mismatch' );

            expect( () => {
                qb.clone().set( { a:1,
                    b:2 } )
                    .newRow().set( { a:1,
                        c:2 } )._toQuery();
            } ).to.throw( 'Multi-row missing field: b' );

            expect( () => {
                qb.clone().set( genQB( 'select' ) ).newRow();
            } ).to.throw( 'INSERT-SELECT can not be mixed with multirow' );
        } );
    } );

    describe( 'UPDATE', function() {
        it( 'should generate simple statement', function() {
            let qb = genQB( 'update' );
            let res = qb.set( 'a', 'b' )._toQuery();
            expect( res ).to.equal( 'UPDATE Table SET a=^b^' );

            res = qb.set( 'a', 'b' ).set( { d: 'D',
                c: 'C' } )._toQuery();
            expect( res ).to.equal( 'UPDATE Table SET a=^b^,d=^D^,c=^C^' );

            res = qb.set( 'a', 'b' ).set( new Map( [ [ 'd', 'D' ], [ 'c', 'C' ] ] ) )._toQuery();
            expect( res ).to.equal( 'UPDATE Table SET a=^b^,d=^D^,c=^C^' );
        } );

        it( 'should generate complex statement', function() {
            let qb = genQB( 'upDaTe' );
            let res = qb.set( 'a', qb.expr( 'A + B' ) )._toQuery();
            expect( res ).to.equal( 'UPDATE Table SET a=A + B' );

            res = qb.set( 'b', genQB( 'select', 'Other' ) )._toQuery();
            expect( res ).to.equal(
                'UPDATE Table SET a=A + B,b=(SELECT * FROM Other)' );
        } );


        it( 'should detect invalid queries', function() {
            let qb = genQB( 'update' );

            expect( () => {
                genQB( 'update', null )._toQuery();
            } ).to.throw( 'Entity is not set' );

            expect( () => {
                qb.clone()._toQuery();
            } ).to.throw( 'Nothing to set' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).get( 'f' )._toQuery();
            } ).to.throw( 'Unused map "select"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).group( 'expr' )._toQuery();
            } ).to.throw( 'Unused array "group"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).having( 'expr' )._toQuery();
            } ).to.throw( 'Unused array "having"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).order( 'expr' )._toQuery();
            } ).to.throw( 'Unused array "order"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).limit( 10 )._toQuery();
            } ).to.throw( 'Unused array "limit"' );

            expect( () => {
                qb.clone().set( 'a', 'A' ).leftJoin( 'Other' )._toQuery();
            } ).to.throw( 'Unused array "joins"' );

            expect( () => {
                qb.clone().set( genQB( 'select' ) )._toQuery();
            } ).to.throw( 'Not an INSERT query for INSERT-SELECT' );

            expect( () => {
                qb.clone().newRow();
            } ).to.throw( 'Not an INSERT query for multi-row' );
        } );
    } );

    describe( 'SELECT', function() {
        it( 'should generate simple statement', function() {
            let qb = genQB( 'select', null );
            let res = qb
                .get( 'a' )
                .get( [ 'c', 'b' ] )
                .get( {
                    d: 'D',
                    q: genQB( 'select' ).get( 'r' ),
                } )
                ._toQuery();
            expect( res ).to.equal( 'SELECT a,c,b,D AS d,(SELECT r FROM Table) AS q' );
        } );

        it( 'should generate complex statement', function() {
            let qb = genQB( 'select', [ 'SomeTable', 'ST' ] );
            let res = qb
                .get( 'ST.*' )
                .get( 'OtherInner.F' )
                .get( 'G', 'SUM(OtherLeft.C)' )
                .get( new Map( [ [ 'M', 'MN' ] ] ) )
                .innerJoin( 'OtherInner' )
                .leftJoin( [ 'OtherLeft', 'OL' ], [ 'OL.X == OtherInner.Y' ] )
                .leftJoin( [ genQB( 'select', null ).get( 'f', '1' ), 'QL' ] )
                .where( 'OtherInner.SF IN', [ 1, 2, 3 ] )
                .group( 'ST.G1' ).group( 'OtherInner.Y' )
                .having( [ 'OR', 'G IS NULL', { 'G <': 0 } ] )
                .having( 'ZZ', 123 )
                .order( 'G' ).order( 'RAND()' )
                .limit( 10, 1 )
                ._toQuery();
            expect( res ).to.equal(
                'SELECT ST.*,OtherInner.F,SUM(OtherLeft.C) AS G,MN AS M ' +
                'FROM SomeTable AS ST ' +
                'INNER JOIN OtherInner ' +
                'LEFT JOIN OtherLeft AS OL ON OL.X == OtherInner.Y ' +
                'LEFT JOIN (SELECT 1 AS f) AS QL '+
                'WHERE OtherInner.SF IN (1,2,3) ' +
                'GROUP BY ST.G1,OtherInner.Y ' +
                'HAVING (G IS NULL OR G < 0) AND ZZ = 123 ' +
                'ORDER BY G ASC,RAND() ASC ' +
                'LIMIT 10 OFFSET 1' );
        } );

        it( 'should check for undefined in .where() & .having()', function() {
            let qb = genQB( 'select' );

            expect( qb.clone().where( 'a', 0 )._toQuery() )
                .to.equal( 'SELECT * FROM Table WHERE a = 0' );

            // No sense, as "a IS NULL" to be used
            expect( qb.clone().where( 'a', null )._toQuery() )
                .to.equal( 'SELECT * FROM Table WHERE a = NULL' );

            expect( qb.clone().having( 'a', 0 )._toQuery() )
                .to.equal( 'SELECT * FROM Table HAVING a = 0' );

            expect( qb.clone().having( 'a', null )._toQuery() )
                .to.equal( 'SELECT * FROM Table HAVING a = NULL' );
        } );

        it( 'should detect invalid queries', function() {
            let qb = genQB( 'select' );

            expect( () => {
                qb.clone().where( 'val IS NULL' ).set( 'f', 'a' )._toQuery();
            } ).to.throw( 'Unused map "toset"' );

            expect( () => {
                qb.clone().innerJoin( genQB( 'select' ).get( 'a' ) );
            } ).to.throw( 'Entity as sub-query format is [QB, alias]: SELECT a FROM Table' );
        } );
    } );

    describe( 'CALL', function() {
        it( 'should generate simple statement', function() {
            let qb = genQB( 'Call', 'Prc' )._callParams( [ 123, 'abc', true ] );
            let res = qb._toQuery();
            expect( res ).to.equal( 'CALL Prc(123,^abc^,TRUE)' );
        } );
    } );

    describe( 'GENERIC', function() {
        it( 'should be supported for helper calls', function() {
            let qb = genQB( null, null );
            expect( qb._state.type ).to.equal( 'GENERIC' );
            expect( qb.escape( 'ab^c' ) )
                .to.be.equal( '^ab\\^c^' );
        } );

        it( 'should not be buildable', function() {
            let qb = genQB( null, null );
            expect( () => qb._toQuery() ).to.throw( 'GENERIC query cannot be built' );
        } );
    } );

    describe( 'Conditions', function() {
        it( 'should generate complex statement', function() {
            let qb = genQB( 'DELETE' );
            let res = qb
                .where( 'val IS NULL' )
                .where( {
                    a : 1,
                    'c <>' : false,
                    'b LIKE ' : 'bb%',
                } )
                .where( new Map( [
                    [ 'd <=', 4 ],
                    [ 'e IN', [ 1, 2, 3 ] ],
                    [ 'f BETWEEN', [ 1, 'a' ] ],
                ] ) )
                .where( [
                    'OR',
                    [ 'AND', 'TRUE', '1' ],
                    [ 'FALSE' ],
                    {
                        f: ( new QueryBuilder( mockFace, 'mocksql', 'select' ) )
                            .get( { res: 'F()' } ),
                    },
                ] )
                ._toQuery();
            expect( res ).to.equal(
                'DELETE FROM Table ' +
                'WHERE val IS NULL' +
                ' AND a = 1' +
                ' AND c <> FALSE' +
                ' AND b LIKE ^bb%^' +
                ' AND d <= 4' +
                ' AND e IN (1,2,3)' +
                ' AND f BETWEEN 1 AND ^a^' +
                ' AND ((TRUE AND 1) OR FALSE OR f = (SELECT F() AS res))' );
        } );
    } );

    describe( '#execute', function() {
        it( 'should execute and return raw result', function( done ) {
            const as = $as();

            as.add(
                ( as ) => {
                    mockFace.select( 'SomeTable' ).execute( as );
                    as.add( ( as, res ) => {
                        expect( res ).to.eql( mockFace._result );
                    } );
                },
                ( as, err ) => {
                    console.log( as.state.error_info );
                    done( as.state.last_exception || err );
                }
            )
                .add( ( as ) => done() )
                .execute();
        } );


        it( 'should execute and return associative result', function( done ) {
            const as = $as();

            as.add(
                ( as ) => {
                    mockFace.select( 'SomeTable' ).executeAssoc( as );
                    as.add( ( as, res, affected ) => {
                        expect( res ).to.eql( [
                            { id: 1,
                                name: 'aaa' },
                            { id: 2,
                                name: 'bb' },
                            { id: 3,
                                name: 'c' },
                        ] );
                        expect( affected, 123 );
                    } );
                },
                ( as, err ) => {
                    console.log( as.state.error_info );
                    done( as.state.last_exception || err );
                }
            )
                .add( ( as ) => done() )
                .execute();
        } );

        it( 'should detect other error', function() {
            expect( function() {
                mockFace.delete( null )._toQuery();
            } )
                .to.throw( 'Entity is not set' );
            expect( function() {
                mockFace.insert( null )._toQuery();
            } )
                .to.throw( 'Entity is not set' );
            expect( function() {
                mockFace.update( null )._toQuery();
            } )
                .to.throw( 'Entity is not set' );

            expect( function() {
                mockFace.update( [ 'a', 'b', 'c' ] );
            } )
                .to.throw( `Entity as array format is [name, alias]: ${[ 'a', 'b', 'c' ]}` );

            expect( function() {
                mockFace.update( [ mockFace.delete(), 'A' ] );
            } )
                .to.throw( 'Not a SELECT sub-query' );

            expect( () => {
                mockFace.select().get( 123 );
            } )
                .to.throw( 'Not supported fields definition: 123' );
            expect( () => {
                mockFace.select().set( 123 );
            } )
                .to.throw( 'Not supported set definition: 123' );


            expect( () => {
                mockFace.select().get( 'M', 123 );
            } )
                .to.throw( 'Expression must be QueryBuilder, Expression or string' );
            expect( () => {
                mockFace.select().get( 'M', true );
            } )
                .to.throw( 'Expression must be QueryBuilder, Expression or string' );
            expect( () => {
                mockFace.select().get( { M: true } );
            } )
                .to.throw( 'Expression must be QueryBuilder, Expression or string' );
            expect( () => {
                mockFace.select().get( new Map( [ [ 'M', true ] ] ) );
            } )
                .to.throw( 'Expression must be QueryBuilder, Expression or string' );

            expect( () => {
                mockFace.select( {} );
            } )
                .to.throw( `Unknown entity type: ${{}}` );

            expect( () => {
                mockFace.select().where( 'a BETWEEN', 'b' );
            } )
                .to.throw( `BETWEEN requires array with two elements` );
            expect( () => {
                mockFace.select().where( 'a BETWEEN', [ 1, 2, 3 ] );
            } )
                .to.throw( `BETWEEN requires array with two elements` );

            expect( function() {
                mockFace.update( 'Tab' ).set( 'a', 1 ).execute( $as() );
            } )
                .to.throw( 'Unsafe DML' );
            expect( function() {
                mockFace.delete( 'Tab' ).execute( $as() );
            } )
                .to.throw( 'Unsafe DML' );

            expect( function() {
                mockFace.delete( 'Tab' ).where( 123 );
            } )
                .to.throw( 'Unknown condition type: 123' );

            //--
            mockFace._db_type = 'mockfail';
            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.IDriver {} );

            //--
            expect( () => {
                mockFace.select( 'A' );
            } )
                .to.throw( 'Not implemented' );

            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.IDriver {
                constructor() {
                    super( new class extends QueryBuilder.Helpers {
                        entity( v ) {
                            return v;
                        }
                    } );
                }
            } );
            mockFace.select( 'A' );

            //--
            expect( () => {
                mockFace.select().escape( 'a' );
            } )
                .to.throw( 'Not implemented' );

            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.IDriver {
                constructor() {
                    super( new class extends QueryBuilder.Helpers {
                        entity( v ) {
                            return v;
                        }
                        escape( v ) {
                            return v;
                        }
                    } );
                }
            } );
            mockFace.select().escape( 'a' );

            //--
            expect( () => {
                mockFace.select().expr( 'a' );
            } )
                .to.throw( 'Not implemented' );

            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.IDriver {
                constructor() {
                    super( new class extends QueryBuilder.Helpers {
                        entity( v ) {
                            return v;
                        }
                        escape( v ) {
                            return v;
                        }
                        expr( v ) {
                            return v;
                        }
                    } );
                }
            } );
            mockFace.select().expr( 'a' );

            //--
            expect( () => {
                mockFace.select().identifier( 'a' );
            } )
                .to.throw( 'Not implemented' );

            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.IDriver {
                constructor() {
                    super( new class extends QueryBuilder.Helpers {
                        entity( v ) {
                            return v;
                        }
                        escape( v ) {
                            return v;
                        }
                        expr( v ) {
                            return v;
                        }
                        identifier( v ) {
                            return v;
                        }
                    } );
                }
            } );
            mockFace.select().identifier( 'a' );

            //--
            expect( () => {
                mockFace.update().get( '345' );
            } )
                .to.throw( 'Invalid field name: 345' );

            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.IDriver {
                constructor() {
                    super( new class extends QueryBuilder.Helpers {
                        entity( v ) {
                            return v;
                        }
                        escape( v ) {
                            return v;
                        }
                        expr( v ) {
                            return v;
                        }
                        identifier( v ) {
                            return v;
                        }
                    } );
                }

                checkField( v ) {}
            } );
            mockFace.select().get( '345' );

            //--
            expect( () => {
                mockFace.select().get( '345' )._toQuery();
            } )
                .to.throw( 'Not implemented' );

            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.IDriver {
                constructor() {
                    super( new class extends QueryBuilder.Helpers {
                        entity( v ) {
                            return v;
                        }
                        escape( v ) {
                            return v;
                        }
                        expr( v ) {
                            return v;
                        }
                        identifier( v ) {
                            return v;
                        }
                    } );
                }

                checkField( v ) {}

                build( state ) {
                    return state;
                }
            } );
            mockFace.select().get( 'a', '1' )._toQuery();
            //--


            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.SQLDriver {} );

            expect( () => {
                mockFace.select().escape( 'a' );
            } )
                .to.throw( 'Not implemented' );

            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.SQLDriver {
                constructor() {
                    super( new class extends QueryBuilder.SQLHelpers {
                        _escapeSimple( v ) {
                            return v;
                        }
                    } );
                }
            } );
            mockFace.select().escape( 'a' );

            //--
            expect( () => {
                mockFace.queryBuilder( 'RAW' )._toQuery();
            } )
                .to.throw( 'Unsupported query type RAW' );

            //--
            QueryBuilder.addDriver( 'mockfail',
                () => new class extends QueryBuilder.SQLDriver {
                    constructor() {
                        super( new class extends QueryBuilder.SQLHelpers {
                            _escapeSimple( v ) {
                                return v;
                            }
                        } );
                    }
                } );
            expect( mockFace.select().getDriver() )
                .to.be.an.instanceof( QueryBuilder.IDriver );

            //---
            expect( () => QueryBuilder.getDriver( 'unknown' ) )
                .to.throw( 'Unknown DB type: unknown' );

            //--
            QueryBuilder.addDriver( 'mockfail', {} );
            expect( () => mockFace.select() )
                .to.throw( 'Not supported driver definition' );
        } );
    } );

    describe( '#prepare', function() {
        it( 'should create simple reusable statement', function() {
            const qb = genQB( 'select' )
                .get( [ 'a', 'b', 'c' ] )
                .where( 'a BETWEEN', [ 1, 10 ] );
            const p = qb.prepare();
            qb.limit( 10 );

            for ( let i = 0; i < 3; ++i ) {
                p.execute( ( q ) => {
                    expect( q ).to.equal(
                        'SELECT a,b,c FROM Table '+
                        'WHERE a BETWEEN 1 AND 10' );
                } );
            }
        } );

        it( 'should create parametrized reusable statement', function() {
            const qb = genQB( 'select' );
            qb.get( [ 'a', 'b', 'c' ] )
                .where( 'a BETWEEN', [
                    qb.param( 'start' ),
                    qb.param( 'end' ),
                ] );
            const p = qb.prepare();
            qb.limit( 10 );

            for ( let i = 0; i < 3; ++i ) {
                p.execute( ( q ) => {
                    expect( q ).to.equal(
                        'SELECT a,b,c FROM Table '+
                        `WHERE a BETWEEN ${1+i} AND ${10+i}` );
                }, {
                    start: 1 + i,
                    end: 10 + i,
                } );
            }
        } );

        it( 'should execute and return associative result', function( done ) {
            const as = $as();

            as.add(
                ( as ) => {
                    mockFace.select( 'SomeTable' )
                        .prepare()
                        .executeAssoc( as );
                    as.add( ( as, res, affected ) => {
                        expect( res ).to.eql( [
                            { id: 1,
                                name: 'aaa' },
                            { id: 2,
                                name: 'bb' },
                            { id: 3,
                                name: 'c' },
                        ] );
                        expect( affected, 123 );
                    } );
                },
                ( as, err ) => {
                    console.log( as.state.error_info );
                    done( as.state.last_exception || err );
                }
            )
                .add( ( as ) => done() )
                .execute();
        } );

        it( 'should support caching in iface', function( done ) {
            const as = $as();

            as.add(
                ( as ) => {
                    const sym = Symbol( 'abc' );
                    mockFace.getPrepared( sym, ( db ) =>
                        db.select( 'SomeTable' )
                            .prepare()
                    );
                    mockFace.getPrepared( sym ).executeAssoc( as );

                    as.add( ( as, res, affected ) => {
                        expect( res ).to.eql( [
                            { id: 1,
                                name: 'aaa' },
                            { id: 2,
                                name: 'bb' },
                            { id: 3,
                                name: 'c' },
                        ] );
                        expect( affected, 123 );
                    } );
                },
                ( as, err ) => {
                    console.log( as.state.error_info );
                    done( as.state.last_exception || err );
                }
            )
                .add( ( as ) => done() )
                .execute();
        } );
    } );

    describe( '#_replaceParams', function() {
        it( 'should properly handle placeholders', function() {
            const helpers = QueryBuilder.getDriver( 'mocksql' ).helpers;
            expect(
                QueryBuilder._replaceParams(
                    helpers,
                    'Some :v :vv :vvv :v',
                    { v: 3,
                        vv: 2,
                        vvv: 1 } )
            ).to.equal( 'Some 3 2 1 3' );
        } );

        it( 'should detected unused params', function() {
            const helpers = QueryBuilder.getDriver( 'mocksql' ).helpers;
            expect( function() {
                QueryBuilder._replaceParams(
                    helpers,
                    'Some :v :vvv :v',
                    { v: 3,
                        vv: 2,
                        vvv: 1 } );
            } ).to.throw( 'Unused param "vv"' );
        } );
    } );
} );

describe( 'XferBuilder', function() {
    const XferBuilder = require( '../XferBuilder' );
    const L2Face = require( '../L2Face' );

    const mockFace = new class extends L2Face {
        constructor() {
            super(
                { limiters: {} },
                { funcs: {},
                    options: {} } );
            this._qresult = null;
            this._xresult = null;
            this._db_type = 'mocksql';
        }

        query( as, q ) {
            as.add( ( as ) => {
                as.success( this._qresult );
            } );
        }

        xfer( as, ql, iso_level ) {
            if ( typeof as === 'function' ) {
                as( ql, iso_level );
            } else {
                as.add( ( as ) => {
                    as.success( this._xresult );
                } );
            }
        }
    };

    QueryBuilder.addDriver( 'mocksql', new MockSQLDriver );

    beforeEach( function() {
        mockFace._qresult = null;
        mockFace._xresult = [
            {
                rows: [ [ 1, 'aaa' ], [ 2, 'bb' ], [ 3, 'c' ] ],
                fields: [ 'id', 'name' ],
                affected: 123,
            },
            {
                rows: null,
                fields: null,
                affected: 321,
            },
            {
                rows: [ [ 1 ] ],
                fields: [ 'a' ],
                affected: 321,
            },
        ];
    } );

    it( 'should have correct constants', function() {
        expect( mockFace.READ_UNCOMMITTED ).to.equal( 'RU' );
        expect( mockFace.READ_COMMITTED ).to.equal( 'RC' );
        expect( mockFace.REPEATABL_READ ).to.equal( 'RR' );
        expect( mockFace.SERIALIZABLE ).to.equal( 'SRL' );
    } );

    it( 'should build transactions', function() {
        let xb;

        xb = mockFace.newXfer();
        xb.select( [ 'Tab', 'T' ], { result: true } ).get( 'a', 'RAND()' );
        xb.update( 'Tab', { affected: 1 } ).set( 'a', mockFace.select( 'Other' ).get( 'b' ) );
        xb.insert( 'Other' ).set( 'l', 'ABC' );
        xb.delete( 'Other' ).where( 'l', 'Zzz' );
        xb.call( 'Prc', [ 123, 'abc', true ] );
        xb.raw( 'Something Cazy :b, :a', { a: 1,
            b: 'c' } );
        xb.clone().execute( function( ql, isol ) {
            expect( isol ).to.equal( 'RC' );
            expect( ql ).to.eql( [
                { q: 'SELECT RAND() AS a FROM Tab AS T',
                    result: true },
                { q: 'UPDATE Tab SET a=(SELECT b FROM Other)',
                    affected: 1 },
                { q: 'INSERT INTO Other (l) VALUES (^ABC^)' },
                { q: 'DELETE FROM Other WHERE l = ^Zzz^' },
                { q: 'CALL Prc(123,^abc^,TRUE)' },
                { q: 'Something Cazy ^c^, 1' },
            ] );
        }, true );
    } );

    it( 'should return associative results', function( done ) {
        const as = $as();

        as.add(
            ( as ) => {
                const xfer = mockFace.newXfer( 'ABC' );
                xfer.select();
                xfer.executeAssoc( as );

                as.add( ( as, res, affected ) => {
                    expect( res ).to.eql( [
                        {
                            rows: [
                                { id: 1,
                                    name: 'aaa' },
                                { id: 2,
                                    name: 'bb' },
                                { id: 3,
                                    name: 'c' },
                            ],
                            affected: 123,
                        },
                        {
                            rows: [],
                            affected: 321,
                        },
                        {
                            rows: [ { a: 1 } ],
                            affected: 321,
                        },
                    ] );
                    expect( affected, 123 );
                } );
            },
            ( as, err ) => {
                console.log( as.state.error_info );
                done( as.state.last_exception || err );
            }
        )
            .add( ( as ) => done() )
            .execute();
    } );

    it( 'should use isolation level', function() {
        $as()
            .add( ( as ) => {
                const xfer = mockFace.newXfer( 'ABC' );
                xfer.select();
                xfer.execute( as );
            } )
            .add( ( as, ql, isol ) => {
                expect( isol ).to.equal( 'ABC' );
            } )
            .execute();
    } );

    it( 'should forbid direct clone()/execute() on QueryBuilder', function() {
        expect( function() {
            mockFace.newXfer( 'ABC' ).select().clone();
        } )
            .to.throw( 'Cloning is not allowed' );
        expect( function() {
            mockFace.newXfer( 'ABC' ).select().execute( $as() );
        } )
            .to.throw( 'Please use XferBuilder.execute()' );
        expect( function() {
            mockFace.newXfer( 'ABC' ).select().executeAssoc( $as() );
        } )
            .to.throw( 'Please use XferBuilder.execute()' );
    } );

    it( 'should check query options', function() {
        expect( function() {
            mockFace.newXfer( 'ABC' ).select( 'a', { return: true } );
        } )
            .to.throw( 'Invalid query option: return' );
    } );

    it( 'should support QB shortcuts', function() {
        expect( mockFace.newXfer( 'ABC' ).expr( 'abc' ) )
            .to.be.instanceof( QueryBuilder.Expression );
        expect( mockFace.newXfer( 'ABC' ).expr( 'abc' ).toQuery() )
            .to.equal( 'abc' );

        expect( mockFace.newXfer( 'ABC' ).param( 'abc' ) )
            .to.be.instanceof( QueryBuilder.Expression );
        expect( mockFace.newXfer( 'ABC' ).param( 'abc' ).toQuery() )
            .to.be.equal( ':abc' );

        expect( mockFace.newXfer( 'ABC' ).escape( 'ab^c' ) )
            .to.be.equal( '^ab\\^c^' );

        expect( function() {
            mockFace.newXfer( 'ABC' ).identifier( 'abc' );
        } )
            .to.throw( 'Not implemented' );
    } );

    describe( '#prepare', function() {
        it( 'should prepare simple transactions', function() {
            let xb;

            xb = mockFace.newXfer();
            xb.select( [ 'Tab', 'T' ], { result: true } ).get( 'a', 'RAND()' );
            xb.update( 'Tab', { affected: 1 } ).set( 'a', mockFace.select( 'Other' ).get( 'b' ) );
            xb.insert( 'Other' ).set( 'l', 'ABC' );
            xb.delete( 'Other' ).where( 'l', 'Zzz' );
            xb.call( 'Prc', [ 123, 'abc', true ] );
            xb.raw( 'Something Cazy :b, :a', { a: 1,
                b: 'c' } );
            let p = xb.prepare( true );
            xb.raw( 'Must not be there' );

            p.execute( function( ql, isol ) {
                expect( isol ).to.equal( 'RC' );
                expect( ql ).to.eql( [
                    { q: 'SELECT RAND() AS a FROM Tab AS T',
                        result: true },
                    { q: 'UPDATE Tab SET a=(SELECT b FROM Other)',
                        affected: 1 },
                    { q: 'INSERT INTO Other (l) VALUES (^ABC^)' },
                    { q: 'DELETE FROM Other WHERE l = ^Zzz^' },
                    { q: 'CALL Prc(123,^abc^,TRUE)' },
                    { q: 'Something Cazy ^c^, 1' },
                ] );
            } );
        } );

        it( 'should prepare parametrized transactions', function() {
            let xb;

            xb = mockFace.newXfer();
            let xsb = xb.select( [ 'Tab', 'T' ], { result: true } ).get( 'a', 'RAND()' );
            xb.update( 'Tab', { affected: 1 } ).set( 'a', mockFace.select( 'Other' ).get( 'b' ) );
            xb.insert( 'Other' ).set( 'l', xsb.param( 'lset' ) );
            xb.delete( 'Other' ).where( 'l', xsb.param( 'lw' ) );
            xb.call( 'Prc', [ 123, 'abc', true ] );
            xb.raw( 'Something Cazy :b, :a' );
            let p = xb.prepare( true );
            xb.raw( 'Must not be there' );

            p.execute( function( ql, isol ) {
                expect( isol ).to.equal( 'RC' );
                expect( ql ).to.eql( [
                    { q: 'SELECT RAND() AS a FROM Tab AS T',
                        result: true },
                    { q: 'UPDATE Tab SET a=(SELECT b FROM Other)',
                        affected: 1 },
                    { q: 'INSERT INTO Other (l) VALUES (^ABC^)' },
                    { q: 'DELETE FROM Other WHERE l = ^Zzz^' },
                    { q: 'CALL Prc(123,^abc^,TRUE)' },
                    { q: 'Something Cazy ^c^, 1' },
                ] );
            }, {
                a: 1,
                b: 'c',
                lset: 'ABC',
                lw: 'Zzz',
            } );
        } );

        it( 'should return associative results', function( done ) {
            const as = $as();

            as.add(
                ( as ) => {
                    mockFace.newXfer( 'ABC' )
                        .prepare()
                        .executeAssoc( as, {} );
                    as.add( ( as, res, affected ) => {
                        expect( res ).to.eql( [
                            {
                                rows: [
                                    { id: 1,
                                        name: 'aaa' },
                                    { id: 2,
                                        name: 'bb' },
                                    { id: 3,
                                        name: 'c' },
                                ],
                                affected: 123,
                            },
                            {
                                rows: [],
                                affected: 321,
                            },
                            {
                                rows: [ { a: 1 } ],
                                affected: 321,
                            },
                        ] );
                        expect( affected, 123 );
                    } );
                },
                ( as, err ) => {
                    console.log( as.state.error_info );
                    done( as.state.last_exception || err );
                }
            )
                .add( ( as ) => done() )
                .execute();
        } );

        it( 'should detect FOR clause errors', function() {
            //---
            mockFace._db_type = 'mocksql';
            expect( () => {
                mockFace.newXfer().delete( 'A' ).forUpdate();
            } )
                .to.throw( 'FOR clause is supported only for SELECT' );

            expect( () => {
                mockFace.newXfer().select( 'A' ).forUpdate().forUpdate();
            } )
                .to.throw( 'FOR clause is already set' );
            expect( () => {
                mockFace.newXfer().select( 'A' ).forUpdate().forSharedRead();
            } )
                .to.throw( 'FOR clause is already set' );
            expect( () => {
                mockFace.newXfer().select( 'A' ).forUpdate()._toQuery();
            } )
                .to.throw( 'Unused generic "forClause"' );
        } );

        it( 'should detect other error', function() {
            //--
            mockFace._db_type = 'mockfail';

            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.IDriver {
                entity( entity ) {
                    return entity;
                }
            } );

            //--
            expect( () => {
                mockFace.newXfer().select( 'A' ).backref( 1, 'f', true );
            } )
                .to.throw( 'Not implemented' );

            QueryBuilder.addDriver( 'mockfail', class extends QueryBuilder.IDriver {
                constructor() {
                    super( new class extends QueryBuilder.Helpers {
                        entity( entity ) {
                            return entity;
                        }
                    } );
                }

                backref( ...args ) {
                    return args;
                }
            } );
            mockFace.newXfer().select( 'A' ).backref( 1, 'f', true );
        } );
    } );
} );

