
const expect = require('chai').expect;

module.exports = function(describe, it, vars)
{
    describe('QueryBuilder', () => {
        it ('should work with query builder', (done) => {
            const as = vars.as;
            const ccm = vars.ccm;
        
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
            const as = vars.as;
            const ccm = vars.ccm;
        
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
            const as = vars.as;
            const ccm = vars.ccm;
        
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
            const as = vars.as;
            const ccm = vars.ccm;
        
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
            const as = vars.as;
            const ccm = vars.ccm;
        
            as.add(
                (as) => {
                    const iface = ccm.iface('ml1');
                    iface.select('test.Toblo').execute(as);
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

        it ('should catch high limit', (done) => {
            const as = vars.as;
            const ccm = vars.ccm;
        
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
    
    describe('XferBuilder', function() {
    });
};
