'use strict';

require( './prepare' );

const expect = require( 'chai' ).expect;
const $as = require( 'futoin-asyncsteps' );


describe( 'SQLiteDriver', function()
{
    const { QueryBuilder } = require( '../main' );
    const drv = QueryBuilder.getDriver( 'sqlite' );
    const helpers = drv.helpers;

    it( 'should escape values correctly', () =>
    {
        expect( helpers.escape( true ) ).to.equal( 'TRUE' );
        expect( helpers.escape( false ) ).to.equal( 'FALSE' );
        expect( helpers.escape( 0 ) ).to.equal( '0' );
        expect( helpers.escape( 100 ) ).to.equal( '100' );
        expect( helpers.escape( -300 ) ).to.equal( '-300' );
        expect( helpers.escape( 1.5 ) ).to.equal( '1.5' );
        expect( helpers.escape( "" ) ).to.equal( "''" );
        expect( helpers.escape( "Some ' string ' \" \\" ) )
            .to.equal( "'Some '' string '' \" \\'" );
    } );

    it( 'should escape identifiers correctly', () =>
    {
        expect( helpers.identifier( 'one' ) ).to.equal( '"one"' );
        expect( helpers.identifier( 'one.two' ) ).to.equal( '"one"."two"' );
        expect( helpers.identifier( 'on"e.t"w"o' ) ).to.equal( '"on""e"."t""w""o"' );
    } );

    it( 'should create xfer back references', () =>
    {
        expect( drv.backref( 3, 'field' ).toQuery() ).to.equal( "$'3:field:s'$" );
        expect( drv.backref( 3, 'field', true ).toQuery() ).to.equal( "$'3:field:m'$" );
    } );
} );


describe( 'SQLiteService', () =>
{
    const Executor = require( 'futoin-executor/Executor' );
    const AdvancedCCM = require( 'futoin-invoker/AdvancedCCM' );
    const L1Face = require( '../L1Face' );
    const L2Face = require( '../L2Face' );
    const SQLiteService = require( '../SQLiteService' );
    const $as = require( 'futoin-asyncsteps' );

    const vars = {
        as: null,
        ccm: null,
        executor: null,
        haveStored: false,
        schema: 'main.',
    };

    beforeEach( function()
    {
        const as = vars.as = $as();
        const ccm = vars.ccm = new AdvancedCCM();
        const executor = vars.executor = new Executor( ccm );

        executor.on( 'notExpected', function()
        {
            console.log( arguments );
        } );

        as.add(
            ( as ) =>
            {
                SQLiteService.register( as, executor, {
                    port: __dirname + '/sqlite.db',
                    raw: {
                        pragmas: [
                            'synchronous = OFF',
                            'journal_mode = MEMORY',
                        ],
                    },
                } );
                L1Face.register( as, ccm, 'sl1', executor );
                L2Face.register( as, ccm, 'sl2', executor );
                ccm.alias( 'sl1', 'l1' );
                ccm.alias( 'sl2', 'l2' );
            },
            ( as, err ) =>
            {
                console.log( as.state.error_info );
                console.log( as.state.last_exception );
            }
        );
    } );

    afterEach( function( done )
    {
        const ccm = vars.ccm;
        const executor = vars.executor;
        ccm.once( 'close', done );
        ccm.close();
        executor.close();
        vars.ccm = null;
        vars.executor = null;
    } );

    describe( 'specific', function()
    {
        it ( 'should execute basic native queries', ( done ) =>
        {
            const as = vars.as;
            const ccm = vars.ccm;

            as.add(
                ( as ) =>
                {
                    ccm.iface( 'sl1' ).query( as, 'DROP TABLE IF EXISTS main.Tbl' );
                    ccm.iface( 'sl1' ).query( as, 'DROP TABLE IF EXISTS main.Snd' );
                    ccm.iface( 'sl2' ).query( as,
                        'CREATE TABLE main.Tbl(' +
                                'id integer primary key autoincrement, ' +
                                'name TEXT not null unique, ' +
                                'ts DATETIME' +
                            ')' );
                    ccm.iface( 'sl2' ).query( as,
                        'CREATE TABLE main.Snd(' +
                                'snd_id integer primary key autoincrement, ' +
                                'ref_id int not null REFERENCES Tbl(id), ' +
                                'data BLOB not null, ' +
                                'ts DATETIME ' +
                            ')' );
                    as.add( ( as ) => done() );
                },
                ( as, err ) =>
                {
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                    done( as.state.last_exception );
                }
            );
            as.execute();
        } );

        it ( 'should catch invalid query', ( done ) =>
        {
            const as = vars.as;
            const ccm = vars.ccm;

            as.add(
                ( as ) =>
                {
                    const iface = ccm.iface( 'sl1' );
                    iface.query( as, 'Obviously invalid()' );
                    as.add( ( as ) => done( 'Fail' ) );
                },
                ( as, err ) =>
                {
                    if ( err === 'InvalidQuery' )
                    {
                        as.success();
                        return;
                    }

                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                    done( as.state.last_exception );
                }
            );
            as.add(
                ( as ) =>
                {
                    const iface = ccm.iface( 'sl1' );
                    iface.query( as, ' ' );
                    as.add( ( as ) => done( 'Fail' ) );
                },
                ( as, err ) =>
                {
                    if ( err === 'InvalidQuery' )
                    {
                        as.success();
                        return;
                    }

                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                    done( as.state.last_exception );
                }
            );
            as.add(
                ( as ) =>
                {
                    const iface = ccm.iface( 'sl1' );
                    iface.query( as, 'SELECT a b c FROM X' );
                    as.add( ( as ) => done( 'Fail' ) );
                },
                ( as, err ) =>
                {
                    if ( err === 'InvalidQuery' )
                    {
                        done();
                        as.success();
                        return;
                    }

                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                    done( as.state.last_exception );
                }
            );
            as.execute();
        } );
    } );

    require( './commonsuite' )( describe, it, vars );
} );
