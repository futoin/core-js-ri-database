'use strict';

const expect = require('chai').expect;
const $as = require('futoin-asyncsteps');


describe('PostgreSQLDriver', function() {
    const { QueryBuilder } = require('../main');
    const drv = QueryBuilder.getDriver('postgresql');
    
    it('should escape values correctly', () => {
        expect( drv.escape(true) ).to.equal('TRUE');
        expect( drv.escape(false) ).to.equal('FALSE');
        expect( drv.escape(0) ).to.equal('0');
        expect( drv.escape(100) ).to.equal('100');
        expect( drv.escape(-300) ).to.equal('-300');
        expect( drv.escape(1.5) ).to.equal('1.5');
        expect( drv.escape("") ).to.equal("''");
        expect( drv.escape("Some ' string ' \" \\") )
            .to.equal("'Some '' string '' \" \\\\'");
    });
    
    it('should escape identifiers correctly', () => {
        expect( drv.identifier('one') ).to.equal('"one"');
        expect( drv.identifier('one.two') ).to.equal('"one"."two"');
        expect( drv.identifier('on"e.t"w"o') ).to.equal('"on""e"."t""w""o"');
    });
        
    it('should create xfer back references', () => {
        expect( drv.backref(3, 'field').toQuery() ).to.equal("$'3:field:s'$");
        expect( drv.backref(3, 'field', true).toQuery() ).to.equal("$'3:field:m'$");
    });
    
    it('should support RETURNING clause', () => {
        let qb;
    
        qb = new QueryBuilder(null, 'postgresql', 'insert', 'tbl');
        qb.set('name', 'abc').get(['id', 'tS']);
        expect( qb._toQuery() )
            .to.equal('INSERT INTO tbl (name) VALUES (\'abc\') ' +
                      'RETURNING id,tS AS "tS"');
    
        qb = new QueryBuilder(null, 'postgresql', 'update', 'tbl');
        qb.set('name', 'abc').get(['ID', 'ts']).where('name', 'xyz');
        expect( qb._toQuery() )
            .to.equal('UPDATE tbl SET name=\'abc\' WHERE name = \'xyz\' ' +
                      'RETURNING ID AS "ID",ts');
    
        qb = new QueryBuilder(null, 'postgresql', 'delete', 'tbl');
        qb.get(['id', 'ts']).where('name', 'xyz');
        expect( qb._toQuery() )
            .to.equal('DELETE FROM tbl WHERE name = \'xyz\' ' +
                      'RETURNING id,ts');
    });
});


describe('PostgreSQLService', () => {
    const Executor = require('futoin-executor/Executor');
    const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
    const L1Face = require('../L1Face');
    const L2Face = require('../L2Face');
    const PostgreSQLService = require('../PostgreSQLService');
    const $as = require('futoin-asyncsteps');
    const moment = require('moment');
    
    const vars = {
        as: null,
        ccm: null,
        executor: null,
        formatDate: (d) => moment(d).format('YYYY-MM-DD HH:mm:ss'),
        haveStored: true,
    };
    
    beforeEach(() => {
        const as = vars.as = $as();
        const ccm = vars.ccm = new AdvancedCCM();
        const executor = vars.executor = new Executor(ccm);
        
        executor.on('notExpected', function(){
            console.log(arguments);
        });
        
        as.add(
            (as) => {
                PostgreSQLService.register(as, executor, {
                    host: '127.0.0.1',
                    port: 5432,
                    user: 'ftntest',
                    password: 'test',
                    database: 'test',
                    conn_limit: 2,
                });
                L1Face.register(as, ccm, 'pl1', executor);
                L2Face.register(as, ccm, 'pl2', executor);
                ccm.alias('pl1', 'l1');
                ccm.alias('pl2', 'l2');
            },
            (as, err) => {
                console.log(as.state.error_info);
                console.log(as.state.last_exception);
            }
        );
    });
        
    afterEach(() => {
        const ccm = vars.ccm;
        const executor = vars.executor;
        ccm.close();
        executor.close();
    });
    
    describe('specific', function() {
        it ('should execute basic native queries', (done) => {
            const as = vars.as;
            const ccm = vars.ccm;
            
            as.add(
                (as) => {
                    ccm.iface('pl1').query(as, 'DROP SCHEMA IF EXISTS test CASCADE');
                    ccm.iface('pl2').query(as, 'CREATE SCHEMA test');
                    ccm.iface('pl2').query(as,
                            'CREATE TABLE test.Tbl(' +
                                'id serial primary key, ' +
                                'name VARCHAR(255) not null unique, ' +
                                'ts timestamp' +
                            ')');
                    ccm.iface('pl2').query(as,
                            'CREATE TABLE test.Snd(' +
                                'snd_id serial primary key, ' +
                                'ref_id int not null REFERENCES test.Tbl(id), ' +
                                'data bytea not null, ' +
                                'ts timestamp ' +
                            ')');
                    ccm.iface('pl2').query(as,
                            'CREATE FUNCTION test.Proc(IN a INT) ' +
                            'RETURNS TABLE (a int, b int, c int) AS ' +
                            '$$ SELECT 1, 2, 3; $$ LANGUAGE SQL');
                    ccm.iface('pl2').query(as,
                            'CREATE FUNCTION test.CancelTest() ' +
                            'RETURNS void AS ' +
                            '$$ SELECT pg_sleep(10); $$ LANGUAGE SQL');
                    as.add( (as) => done() );
                },
                (as, err) => {
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.execute();
        });

        it ('should catch invalid query', (done) => {
            const as = vars.as;
            const ccm = vars.ccm;
        
            as.add(
                (as) => {
                    const iface = ccm.iface('pl1');
                    iface.query(as, 'Obviously invalid()');
                    as.add( (as) => done( 'Fail' ) );
                },
                (as, err) => {
                    if (err === 'InvalidQuery') {
                        as.success();
                        return;
                    }
                    
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.add(
                (as) => {
                    const iface = ccm.iface('pl1');
                    iface.query(as, ' ');
                    as.add( (as) => done( 'Fail' ) );
                },
                (as, err) => {
                    if (err === 'InvalidQuery') {
                        as.success();
                        return;
                    }
                    
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.add(
                (as) => {
                    const iface = ccm.iface('pl1');
                    iface.query(as, 'SELECT a b c FROM X');
                    as.add( (as) => done( 'Fail' ) );
                },
                (as, err) => {
                    if (err === 'InvalidQuery') {
                        done();
                        as.success();
                        return;
                    }
                    
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.execute();
        });
        
        it ('should support RETURNING clause', (done) => {
            const as = vars.as;
            const ccm = vars.ccm;
            
            as.add(
                (as) => {
                    ccm.iface('pl1')
                        .insert('test.Tbl')
                        .set('name', 'ret1')
                        .get('name')
                        .executeAssoc(as);
                    as.add( (as, res, affected) => {
                        expect( res ).to.eql([
                            { name: 'ret1' }
                        ]);
                        expect( affected ).to.equal( 1 );
                    });
            
                    ccm.iface('pl2')
                        .update('test.Tbl')
                        .set('name', 'ret2')
                        .where('name', 'ret1')
                        .get('name')
                        .executeAssoc(as);
                    as.add( (as, res, affected) => {
                        expect( res ).to.eql([
                            { name: 'ret2' }
                        ]);
                        expect( affected ).to.equal( 1 );
                    });
        
                    ccm.iface('pl1')
                        .delete('test.Tbl')
                        .where('name', 'ret2')
                        .get('Name', 'name')
                        .executeAssoc(as);
                    as.add( (as, res, affected) => {
                        expect( res ).to.eql([
                            { Name: 'ret2' }
                        ]);
                        expect( affected ).to.equal( 1 );
                    });
                    
                     ccm.iface('pl2').query(as,
                            'ALTER SEQUENCE test.Tbl_id_seq RESTART 1');
    
                    as.add( (as) => done() );
                },
                (as, err) => {
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.execute();
        });
    });
    
    require('./commonsuite')(describe, it, vars);
});
