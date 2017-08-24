'use strict';

const expect = require('chai').expect;
const $as = require('futoin-asyncsteps');


describe('MySQLDriver', function() {
    const { QueryBuilder } = require('../main');
    const drv = QueryBuilder.getDriver('mysql');

    it('should escape values correctly', () => {
        expect( drv.escape(true) ).to.equal('true');
        expect( drv.escape(false) ).to.equal('false');
        expect( drv.escape(0) ).to.equal('0');
        expect( drv.escape(100) ).to.equal('100');
        expect( drv.escape(-300) ).to.equal('-300');
        expect( drv.escape(1.5) ).to.equal('1.5');
        expect( drv.escape("") ).to.equal("''");
        expect( drv.escape("Some ' string ' \" \\") )
            .to.equal("'Some \\' string \\' \\\" \\\\'");
    });
    
    it('should escape identifiers correctly', () => {
        expect( drv.identifier('one') ).to.equal('`one`');
        expect( drv.identifier('one.two') ).to.equal('`one`.`two`');
        expect( drv.identifier('on`e.t`w`o') ).to.equal('`on``e`.`t``w``o`');
    });
    
    it('should create xfer back references', () => {
        expect( drv.backref(3, 'field').toQuery() ).to.equal("$'3:field:s'$");
        expect( drv.backref(3, 'field', true).toQuery() ).to.equal("$'3:field:m'$");
    });
});

describe('MySQLService', () => {
    const Executor = require('futoin-executor/Executor');
    const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
    const L1Face = require('../L1Face');
    const L2Face = require('../L2Face');
    const MySQLService = require('../MySQLService');
    const $as = require('futoin-asyncsteps');
    const moment = require('moment');
    
    const vars = {
        as: null,
        ccm: null,
        executor: null,
        formatDate: (d) => moment(d).format('YYYY-MM-DD HH:mm:ss'),
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
                MySQLService.register(as, executor, {
                    host: '127.0.0.1',
                    port: 3306,
                    user: 'ftntest',
                    password: '',
                    database: 'mysql',
                    conn_limit: 2,
                });
                L1Face.register(as, ccm, 'ml1', executor);
                L2Face.register(as, ccm, 'ml2', executor);
                ccm.alias('ml1', 'l1');
                ccm.alias('ml2', 'l2');
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
                    ccm.iface('ml1').query(as, 'DROP DATABASE IF EXISTS test');
                    ccm.iface('ml2').query(as, 'CREATE DATABASE test');
                    ccm.iface('ml2').query(as,
                            'CREATE TABLE test.Tbl(' +
                                'id INT auto_increment primary key, ' +
                                'name VARCHAR(255) not null unique, ' +
                                'ts DATETIME' +
                            ') ENGINE=InnoDB');
                    ccm.iface('ml2').query(as,
                            'CREATE PROCEDURE test.Proc(IN a INT) BEGIN select 1, 2, 3; END');
                    ccm.iface('ml2').query(as,
                            'CREATE PROCEDURE test.MultiRes(IN a INT) BEGIN select 1; select 2; END');
                    ccm.iface('ml2').query(as,
                            'CREATE PROCEDURE test.CancelTest() BEGIN CALL SLEEP(10); END');
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
                    const iface = ccm.iface('ml1');
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
                    const iface = ccm.iface('ml1');
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
                    const iface = ccm.iface('ml1');
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
        
        it ('query multi res', (done) => {
            const as = vars.as;
            const ccm = vars.ccm;
        
            as.add(
                (as) => {
                    const xfer = ccm.iface('l2').callStored(as, 'test.MultiRes', [1]);
                    as.add( (as) => done( 'Fail' ) );
                },
                (as, err) => {
                    if (err === 'InvalidQuery' &&
                        as.state.error_info === 'More than one result'
                    ) {
                        as.success();
                        return;
                    }
                    
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.add((as) => done());
            as.execute();
        });
        
        it ('xfer multi res for selected condition', (done) => {
            const as = vars.as;
            const ccm = vars.ccm;
        
            as.add(
                (as) => {
                    const xfer = ccm.iface('l2').newXfer();
                    xfer.raw('CALL test.MultiRes(1)', null, {selected: 1});
                    xfer.execute(as);
                    as.add( (as) => done( 'Fail' ) );
                },
                (as, err) => {
                    if (err === 'XferCondition' &&
                        as.state.error_info === 'Multiple results for conditions'
                    ) {
                        as.success();
                        return;
                    }
                    
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.add((as) => done());
            as.execute();
        });
    });
    
    require('./commonsuite')(describe, it, vars);
});
