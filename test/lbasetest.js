

const expect = require('chai').expect;
const $as = require('futoin-asyncsteps');

const Executor = require('futoin-executor/Executor');
const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
const L1Service = require('../L1Service');
const L2Service = require('../L2Service');
const L1Face = require('../L1Face');
const L2Face = require('../L2Face');

class FakeL1Face extends L1Face
{
    get _db_type() { return 'fake'; }
}

class FakeL2Face extends L2Face
{
    get _db_type() { return 'fake'; }
}


describe('L1Service', () => {
    it('should have default errors', (done) => {
        const as = $as();
        const ccm = new AdvancedCCM();
        const executor = new Executor(ccm);
        
        executor.on('notExpected', function(){
            console.log(arguments);
        });
        
        as.add(
            (as) => {
                L1Service.register(as, executor);
                FakeL1Face.register(as, ccm, 'l1', executor);
 
                as.add(
                    (as) => {
                        ccm.iface('l1').query(as, 'fail');
                    },
                    (as, err) => {
                        if (err === 'NotImplemented') {
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        ccm.iface('l1').callStored(as, 'fail', [123]);
                    },
                    (as, err) => {
                        if (err === 'NotImplemented') {
                            as.success();
                        }
                    }
                );
                as.add(
                    (as) => {
                        ccm.iface('l1').call(as, 'getFlavour');
                    },
                    (as, err) => {
                        if (err === 'NotImplemented') {
                            as.success();
                        }
                    }
                );
                as.add((as) => {
                    ccm.close();
                    executor.close();
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
});



describe('L2Service', () => {
    it('should have default errors', (done) => {
        const as = $as();
        const ccm = new AdvancedCCM();
        const executor = new Executor(ccm);
        
        executor.on('notExpected', function(){
            console.log(arguments);
        });
        
        as.add(
            (as) => {
                L2Service.register(as, executor);
                FakeL2Face.register(as, ccm, 'l2', executor);
                
                as.add(
                    (as) => {
                        ccm.iface('l2').xfer(as, [{q:' '}], 'RU');
                    },
                    (as, err) => {
                        if (err === 'NotImplemented') {
                            as.success();
                        }
                    }
                );
                
                as.add((as) => {
                    ccm.close();
                    executor.close();
                    done();
                });            },
            (as, err) => {
                console.log(as.state.error_info);
                console.log(as.state.last_exception);
                done(as.state.last_exception);
            }
        );
        as.execute();
    });
});
