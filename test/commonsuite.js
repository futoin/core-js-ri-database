'use strict';

const expect = require('chai').expect;
process.on('warning', e => console.warn(e.stack));

module.exports = function(describe, it, vars)
{
    describe('QueryBuilder', function() {
        it ('should work with query builder', function(done) {
            const as = vars.as;
            const ccm = vars.ccm;
        
            as.add(
                (as) => {
                    const iface = ccm.iface('l1');
                    iface.insert('test.Tbl').set('name', 'aaa').execute(as);
                    
                    iface.insert('test.Tbl')
                        .set('name', 'bbb')
                        .set('ts', vars.formatDate(new Date('2017-08-08T12:00:00Z')))
                        .getInsertID('id')
                        .executeAssoc(as);
                    as.add( (as, res, affected) => {
                        expect(res).to.eql([
                            { $id: 2 }
                        ]);
                        expect(affected).to.equal(1);
                    });
                    
                    iface.update('test.Tbl')
                        .set('ts', vars.formatDate(new Date('2017-08-08T12:30:00Z')))
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
                            { id: 2, name: 'bbb',
                              ts: vars.formatDate(new Date('2017-08-08T12:30:00Z')) },
                        ]);
                        expect(affected).to.equal(0);
                    });
                    
                    iface.callStored(as, 'test.Proc', [1]);
                    
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
                    const iface = ccm.iface('l1');
                    
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
                    const iface = ccm.iface('l1');
                    const qb = iface.insert('test.Tbl');
                    qb.set('name', qb.param('nm'));
                    const pq = qb.prepare();
                    const p = as.parallel();
                    
                    for ( let i = 0; i <= 1000; ++i ) {
                        p.add( (as) => pq.execute(as, { nm: i }) );
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


        it ('should catch duplicates', function(done) {
            const as = vars.as;
            const ccm = vars.ccm;
        
            as.add(
                (as) => {
                    const iface = ccm.iface('l1');
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


        it ('should catch errors', function(done){
            const as = vars.as;
            const ccm = vars.ccm;
        
            as.add(
                (as) => {
                    const iface = ccm.iface('l1');
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

        it ('should catch high limit', function(done) {
            const as = vars.as;
            const ccm = vars.ccm;
        
            as.add(
                (as) => {
                    const iface = ccm.iface('l1');
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
        
        it ('should support isolation levels', function(done) {
            const as = vars.as;
            
            as.add(
                (as) => {
                    for ( let isol of ['RU', 'RC', 'RR', 'SRL'] ) {
                        const xfer = vars.ccm.iface('l2').newXfer(isol);
                        xfer.select('test.Tbl').where('name', '123');
                        xfer.execute(as);
                    }
                },
                (as, err) => {
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it ('should execute simple transaction', function(done) {
            const as = vars.as;

            as.add(
                (as) => {
                    let xfer = vars.ccm.iface('l2').newXfer();
                    xfer.insert('test.Tbl', { affected: 1 }).set('name', 'xfer1');
                    xfer.insert('test.Tbl', { affected: 1 }).set('name', 'xfer3');
                    xfer.update('test.Tbl', { affected: true })
                        .set('name', 'xfer2').where('name', 'xfer1');
                    xfer.update('test.Tbl', { affected: false })
                        .set('name', 'xfer2').where('name', 'xfer1');
                    xfer.update('test.Tbl', { affected: 1 })
                        .set('ts', '2017-01-01').where('name', 'xfer2');
                    xfer.select('test.Tbl', { result: true, selected: 2} )
                        .get('name')
                        .where('name LIKE', 'xfer%')
                        .order('name')
                        .forUpdate();
                    xfer.select('test.Tbl', { selected: false} )
                        .where('name LIKE', 'notxfer%')
                        .forSharedRead();
                    xfer.select('test.Tbl', { selected: true} )
                        .where('name', 'xfer2');
                    xfer.delete('test.Tbl', { affected: 2 }).where(
                        ['OR', {'name': 'xfer2'}, {'name': 'xfer3'}]
                    );
                    xfer.delete('test.Tbl', { affected: false }).where(
                        ['OR', {'name': 'xfer2'}, {'name': 'xfer3'}]
                    ); 
                    xfer.call('test.Proc', [123]);
                    xfer.executeAssoc(as);
                    as.add( (as, res) => {
                        expect(res).to.eql([
                            {
                                rows: [
                                    { name: 'xfer2' },
                                    { name: 'xfer3' },
                                ],
                                affected: 0,
                            },
                        ]);
                        done();
                    });
                },
                (as, err) => {
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.execute();
        });
        
        it ('should execute prepared transaction', function(done) {
            this.timeout(10e3);
            const as = vars.as;

            as.add(
                (as) => {
                    const iface = vars.ccm.iface('l2');
                    let xfer = iface.newXfer();
                    let nm = xfer.param('nm');
                    xfer.insert('test.Tbl', { affected: 1 }).set('name', 'xfer1');
                    xfer.insert('test.Tbl', { affected: 1 }).set('name', nm);
                    xfer.update('test.Tbl', { affected: true })
                        .set('name', 'xfer2').where('name', 'xfer1');
                    xfer.update('test.Tbl', { affected: false })
                        .set('name', 'xfer2').where('name', 'xfer1');
                    xfer.update('test.Tbl', { affected: 1 })
                        .set('ts', '2017-01-01').where('name', 'xfer2');
                    xfer.select('test.Tbl', { result: true, selected: 2} )
                        .get('name')
                        .where('name LIKE', 'xfer%')
                        .order('name');
                    xfer.select('test.Tbl', { selected: false} )
                        .where('name LIKE', 'notxfer%');
                    xfer.select('test.Tbl', { selected: true} )
                        .where('name', 'xfer2');
                    xfer.delete('test.Tbl', { affected: 2 }).where(
                        ['OR', {'name': 'xfer2'}, {'name': nm}]
                    );
                    xfer.delete('test.Tbl', { affected: false }).where(
                        ['OR', {'name': 'xfer2'}, {'name': nm}]
                    );
                    xfer.call('test.Proc', [123]);
                    const pxfer = xfer.prepare();
                    
                    expect(function() {
                        pxfer.executeAssoc(as, { nm: 'xfer5', unused: '2' });
                    }).to.throw('Unused param "unused"')
                    
                    // Run sequentially
                    as.repeat(3, (as, i) => {
                        pxfer.executeAssoc(as, { nm: 'xfer5' });
                        as.add( (as, res) => {
                            expect(res).to.eql([
                                {
                                    rows: [
                                        { name: 'xfer2' },
                                        { name: 'xfer5' },
                                    ],
                                    affected: 0,
                                },
                            ]);
                        });
                    });
                    
                    // Get to deadlock
                    as.add(
                        (as) => {
                            const p = as.parallel();
                            
                            for (let i = 0; i < 10; ++i){
                                p.add((as) => {
                                    pxfer.executeAssoc(as, { nm: 'xfer4' });
                                    as.add( (as, res) => {
                                        expect(res).to.eql([
                                            {
                                                rows: [
                                                    { name: 'xfer2' },
                                                    { name: 'xfer4' },
                                                ],
                                                affected: 0,
                                            },
                                        ]);
                                    });
                                });
                            }
                            //as.add((as) => as.error('Fail'));
                        },
                        (as, err) => {
                            if (err === 'DeadLock') {
                                as.success();
                            }
                        }
                    );
                },
                (as, err) => {
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.add((as) => done());
            as.execute();
        });
        
        it ('should fail on conditions', function(done) {
            const as = vars.as;

            as.add( (as) => {
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        xfer.insert('test.Tbl').set('name', 'fail');
                        xfer.select('test.Tbl', { selected: false })
                            .where('name', 'fail');
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferCondition' ) {
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        xfer.insert('test.Tbl').set('name', 'fail');
                        xfer.select('test.Tbl', { selected: true })
                            .where('name', 'nofail');
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferCondition' ) {
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        xfer.insert('test.Tbl').set('name', 'fail');
                        xfer.select('test.Tbl', { selected: 0 })
                            .where('name', 'fail');
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferCondition' ) {
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        xfer.insert('test.Tbl').set('name', 'fail');
                        xfer.update('test.Tbl', { affected: false })
                            .set('ts', '2017-01-01')
                            .where('name', 'fail');
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferCondition' ) {
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        xfer.insert('test.Tbl').set('name', 'fail');
                        xfer.update('test.Tbl', { affected: true })
                            .set('ts', '2017-01-01')
                            .where('name', 'notfail');
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferCondition' ) {
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        xfer.insert('test.Tbl').set('name', 'fail');
                        xfer.update('test.Tbl', { affected: 0 })
                            .set('ts', '2017-01-01')
                            .where('name', 'fail');
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferCondition' ) {
                            as.success();
                        }
                    }
                );
            }, (as, err) => {
                console.log(as.state.error_info);
                console.log(as.state.last_exception);
                done(as.state.last_exception);
            });
            as.add((as) => done());
            as.execute();
        });
        
        it ('should execute template transaction', function(done) {
            this.timeout(10e3);
            const as = vars.as;

            as.add(
                (as) => {
                    const iface = vars.ccm.iface('l2');
                    let xfer = iface.newXfer();
                    
                    xfer.select('test.Tbl', {result: true})
                        .where('id IN', [7, 9, 10, 20]);
                    
                    const s1 = xfer.select('test.Tbl')
                        .where('id', '7')
                        .forSharedRead();
                    const s2 = xfer.select('test.Tbl')
                        .get('name').get('RowID', 'id')
                        .where('id', '9');
                    const s3 = xfer.select('test.Tbl', {selected: 2})
                        .get('RID', 'id')
                        .where('id IN', [10, 20])
                        .forUpdate();
                        
                    const u1 = xfer.update('test.Tbl');
                    u1.set('name', u1.backref(s2, 'name'))
                        .where('id', u1.backref(s2, 'RowID'));
                        
                    const u2 = xfer.update('test.Tbl', { affected: 2 });
                    u2.set('id', u2.expr( 'id + 10000 + ' + u2.backref(s2, 'RowID')) )
                        .where('id IN', u2.backref(s3, 'RID', true));
                        
                    xfer.select('test.Tbl', {result: true})
                        .where('id IN', [7, 9, 10019, 10029]);

                    xfer.executeAssoc(as);
                    as.add( (as, res) => {
                        expect(res[1]).to.eql(
                            {
                                rows: [
                                    { id: 7, name: res[0].rows[0].name, ts: null },
                                    { id: 9, name: res[0].rows[1].name, ts: null },
                                    { id: 10019, name: res[0].rows[2].name, ts: null },
                                    { id: 10029, name: res[0].rows[3].name, ts: null },
                                ],
                                affected: 0,
                            }
                        );
                    });
                },
                (as, err) => {
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.add((as) => done());
            as.execute();
        });
        
        it ('should detect xfer back reference errors', function(done) {
            const as = vars.as;

            as.add( (as) => {
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        const x1 = xfer.select('test.Tbl');
                        const x2 = xfer.select('test.Tbl')
                            .get('id')
                            .where('id', '7');
                        x1.where('id', x1.backref(x2, 'id'));
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferBackRef') {
                            expect(as.state.error_info)
                                .to.equal('Invalid template query ID: 1');
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        const x1 = xfer.select('test.Tbl').where('name', 'not existing');
                        const x2 = xfer.select('test.Tbl');
                        x2.get('id').where('id', x2.backref(x1, 'id'));
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferBackRef') {
                            expect(as.state.error_info)
                                .to.equal('Empty query result for #0');
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        const x1 = xfer.select('test.Tbl').limit(10);
                        const x2 = xfer.select('test.Tbl');
                        x2.get('id').where('id', x2.backref(x1, 'Missing'));
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferBackRef') {
                            expect(as.state.error_info)
                                .to.equal('Invalid template field "Missing" for #0');
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        let xfer = vars.ccm.iface('l2').newXfer();
                        const x1 = xfer.select('test.Tbl').limit(10);
                        const x2 = xfer.select('test.Tbl');
                        x2.get('id').where('id', x2.backref(x1, 'id'));
                        xfer.execute(as);
                        as.add((as) => as.error('Fail'));
                    },
                    (as, err) => {
                        if ( err === 'XferBackRef') {
                            expect(as.state.error_info)
                                .to.equal('More than one row in result #0');
                            as.success();
                        }
                    }
                );
            }, (as, err) => {
                console.log(as.state.error_info);
                console.log(as.state.last_exception);
                done(as.state.last_exception);
            });
            as.add((as) => done());
            as.execute();
        });
    });
    
    describe('JOINs', function() {
        it ('should use proper join', function(done) {
            const as = vars.as;
            
            as.add( (as) => {
                const iface = vars.ccm.iface('l1');
                
                const s = iface.select('test.Tbl');
                s.get('ref_id', 'id')
                    .get('ts', s.escape(vars.formatDate(new Date())))
                    .get('data', s.escape('\x01\x02\x03'))
                    .order('id')
                    .limit(10);
                iface.insert('test.Snd').set(s).execute(as);
                
                iface.select('test.Tbl')
                    .get('C', 'COUNT(*)')
                    .executeAssoc(as);
                as.add((as, res) => as.state.TblC = res[0].C );
                
                iface.select('test.Snd')
                    .get('C', 'COUNT(*)')
                    .executeAssoc(as);
                as.add((as, res) => as.state.SndC = res[0].C );
                
                iface.select('test.Tbl')
                    .leftJoin('test.Snd', 'test.Snd.ref_id = test.Tbl.id')
                    .get('C', 'COUNT(*)')
                    .executeAssoc(as);
                as.add((as, res) => expect(res[0].C).to.equal(as.state.TblC));
                
                iface.select('test.Tbl')
                    .innerJoin('test.Snd', ['test.Snd.ref_id = test.Tbl.id'])
                    .get('C', 'COUNT(*)')
                    .executeAssoc(as);
                as.add((as, res) => expect(res[0].C).to.equal(as.state.SndC));
                
            }, (as, err) => {
                console.log(as.state.error_info);
                console.log(as.state.last_exception);
                done(as.state.last_exception);
            });
            as.add((as) => done());
            as.execute();
        });
    });
    
    describe('Call abort', function() {
        it ('should cancel queries', function(done) {
            const as = vars.as;
                
            as.add(
                (as) => {
                    as.setTimeout(0.2);
                    const p = as.parallel();
                    
                    for ( let i = 0; i < 3; ++i ) {
                        p.add((as) => {
                            vars.ccm.iface('l1').callStored(as, 'CancelTest', []);
                        });
                    }
                },
                (as, err) => {
                    if (err === 'Timeout')
                    {
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
                    const p = as.parallel();
                    
                    for ( let i = 0; i < 3; ++i ) {
                        p.add((as) => {
                            vars.ccm.iface('l1').callStored(as, 'test.Proc', [1]);
                        });
                    }
                },
                (as, err) => {
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
    });
};
