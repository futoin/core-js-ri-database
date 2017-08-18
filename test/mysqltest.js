const expect = require('chai').expect;
const $as = require('futoin-asyncsteps');

const { QueryBuilder } = require('../main');


describe('MySQLDriver', function() {
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
});

describe('MySQLService', () => {
    const Executor = require('futoin-executor/Executor');
    const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
    const L1Face = require('../L1Face');
    const L2Face = require('../L2Face');
    const MySQLService = require('../MySQLService');
    const $as = require('futoin-asyncsteps');
    
    let as;
    let executor;
    let ccm;
    
    beforeEach(() => {
        as = $as();
        ccm = new AdvancedCCM();
        executor = new Executor(ccm);
        
        executor.on('notExpected', function(){
            console.log(arguments);
        });
        
        as.add(
            (as) => {
                MySQLService.register(as, executor, {
                    host: '127.0.0.1',
                    port: 3306,
                    user: 'root',
                    password: '',
                    database: 'mysql',
                    conn_limit: 2,
                });
                L1Face.register(as, ccm, 'ml1', executor);
                L2Face.register(as, ccm, 'ml2', executor);
            },
            (as, err) => {
                console.log(as.state.error_info);
                console.log(as.state.last_exception);
            }
        );
    });
        
    afterEach(() => {
        ccm.close();
        executor.close();
    });
    
    it ('should execute basic queries', (done) => {
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
    
    it ('should work with query builder', (done) => {
        as.add(
            (as) => {
                const iface = ccm.iface('ml1');
                iface.insert('test.Tbl').set('name', 'aaa').execute(as);
                iface.insert('test.Tbl')
                    .set('name', 'bbb')
                    .set('ts', '2017-08-08 12:00:00')
                    .execute(as);
                iface.update('test.Tbl')
                    .set('ts', '2017-08-08 12:30:00')
                    .where('name', 'bbb')
                    .execute(as);
                iface.insert('test.Tbl').set('name', 'ccc').execute(as);
                iface.delete('test.Tbl').where('name', 'ccc').execute(as);
                
                iface.select('test.Tbl').get('C', 'COUNT(*)').executeAssoc(as);
                as.add( (as, res, affected) => {
                    expect(res).to.eql([{ 'C': '2' }]);
                    expect(affected).to.equal(0);
                });
                
                iface.select('test.Tbl').executeAssoc(as);
                as.add( (as, res, affected) => {
                    expect(res).to.eql([
                        { id: 1, name: 'aaa', ts: null },
                        { id: 2, name: 'bbb', ts: '2017-08-08 12:30:00' },
                    ]);
                    expect(affected).to.equal(0);
                });
                
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
    
    it ('should work query queue', function(done) {
        this.timeout( 10e3 );
        as.add(
            (as) => {
                const iface = ccm.iface('ml1');
                
                const p = as.parallel();
                
                for (let i = 0; i < 20; ++i) {
                    p.add( (as) => iface.select('test.Tbl')
                                    .where('name', 'aaa').execute(as) );
                }
                
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
    
    
    it ('should work with prepared query', function(done) {
        this.timeout( 10e3 );
        as.add(
            (as) => {
                const iface = ccm.iface('ml1');
                const qb = iface.insert('test.Tbl');
                qb.set('name', qb.param('nm'));
                const pq = qb.prepare();
                const p = as.parallel();
                
                for ( let i = 0; i <= 1000; ++i ) {
                    p.add( (as) => pq.execute(as, iface, { nm: i }) );
                }
                
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

    
    it ('should catch duplicates', (done) => {
        as.add(
            (as) => {
                const iface = ccm.iface('ml1');
                iface.insert('test.Tbl').set('name', 'ddd').execute(as);
                iface.insert('test.Tbl').set('name', 'ddd').execute(as);
                as.add( (as) => done( 'Fail' ) );
            },
            (as, err) => {
                if (err === 'Duplicate') {
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
    
    
    it ('should catch errors', (done) => {
        as.add(
            (as) => {
                const iface = ccm.iface('ml1');
                iface.query(as, 'SELECT * FROM test.Toblo');
                as.add( (as) => done( 'Fail' ) );
            },
            (as, err) => {
                if (err === 'OtherExecError') {
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
    
    it ('should catch invalid query', (done) => {
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
    
    
    it ('should catch high limit', (done) => {
        as.add(
            (as) => {
                const iface = ccm.iface('ml1');
                iface.select('test.Tbl').execute(as);

                as.add( (as) => done( 'Fail' ) );
            },
            (as, err) => {
                if (err === 'LimitTooHigh') {
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
});
