'use strict';

const AutoConfig = require('../AutoConfig');
const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
const $as = require('futoin-asyncsteps');
const expect = require('chai').expect

describe('AutoConfig', function() {
    it('should auto-configure connections', function(done) {
        const as = $as();
        as.add(
            (as) => {
                AutoConfig.register('funcfake', function() {
                    const L2Service = require('../L2Service');
                    return class extends L2Service {
                        getFlavour(as, reqinfo) {
                            return 'funcfake';
                        }
                    };
                });
                
                AutoConfig.register('objfake',
                    class extends require('../L1Service') {
                        getFlavour(as, reqinfo) {
                            return 'objfake';
                        }
                    });
                
                const ccm = new AdvancedCCM();
                AutoConfig(as, ccm, {
                    default: {
                        type: ['mysql', 'postgresql', 'somesql'],
                    },
                    p: {
                        type: 'postgresql',
                    },
                    m: {
                        type: 'mysql',
                    },
                    func: {
                        type: 'funcfake'
                    },
                    obj: {
                        type: 'objfake',
                    }
                }, {
                    DB_TYPE: 'mysql',
                    DB_HOST: '127.0.0.1',
                    DB_PORT: '3306',
                    DB_USER: 'ftntest',
                    DB_MAXCONN: '3',
                    DB_P_TYPE: 'postgresql',
                    DB_P_HOST: '127.0.0.1',
                    DB_P_PORT: '5432',
                    DB_P_USER: 'ftntest',
                    DB_P_PASS: 'test',
                    DB_P_DB: 'test',
                    DB_P_MAXCONN: '5',
                    DB_M_TYPE: 'mysql',
                    DB_M_HOST: '127.0.0.1',
                    DB_M_PORT: '3306',
                    DB_M_USER: 'ftntest',
                    DB_M_PASS: '',
                    DB_M_DB: 'mysql',
                    DB_M_MAXCONN: '4',
                    DB_FUNC_TYPE: 'funcfake',
                    DB_OBJ_TYPE: 'objfake',
                });
                as.add( (as) => ccm.db().getFlavour(as) );
                as.add( (as, res) => expect(res).to.equal('mysql') );
                
                as.add( (as) => ccm.db('m').getFlavour(as) );
                as.add( (as, res) => expect(res).to.equal('mysql') );
                
                as.add( (as) => ccm.iface('#db.m').getFlavour(as) );
                as.add( (as, res) => expect(res).to.equal('mysql') );
                
                as.add( (as) => ccm.db('p').getFlavour(as) );
                as.add( (as, res) => expect(res).to.equal('postgresql') );

                as.add( (as) => ccm.db().select('mysql.user').limit(1).execute(as) );
                as.add( (as) => ccm.db('m').select('mysql.user').limit(1).execute(as) );
                as.add( (as) => ccm.iface('#db.m').select('mysql.user').limit(1).execute(as) );
                as.add( (as) => ccm.db('p').select('information_schema.tables').limit(1).execute(as) );
                as.add( (as) => ccm.db('func').getFlavour(as) );
                as.add( (as, res) => expect(res).to.equal('funcfake') );
                as.add( (as) => ccm.db('obj').getFlavour(as) );
                as.add( (as, res) => expect(res).to.equal('objfake') );
                as.add( (as) => ccm.close() );
                as.add( (as) => done() );
            },
            (as, err) => {
                console.log(`${err}: ${as.state.error_info}`);
                done(as.state.last_exception);
            }
        );
        as.execute();
    });
    
    it('should handle notExpected', function(done) {
        const as = $as();
        const ccm = new AdvancedCCM();
        as.add(
            (as) => {
                const LogFace = require('futoin-invoker/LogFace');
                const Executor = require('futoin-executor/Executor');
                const executor = new Executor(ccm);
                LogFace.register(as, ccm, executor);
                AutoConfig(as, ccm, {
                    err: {}
                }, {
                    DB_ERR_TYPE: 'mysql',
                    DB_ERR_HOST: '127.0.0.1',
                    DB_ERR_USER: 'error',
                });
                as.add((as) => ccm.db('err').query(as, 'SELECT 1'));
                as.add((as) => as.error('Fail'));
            },
            (as, err) => {
                if (err === 'InternalError')
                {
                    ccm.close();
                    done();
                } else {
                    console.log(`${err}: ${as.state.error_info}`);
                    done(as.state.last_exception);
                }
            }
        );
        as.execute();
    });
    
    it('should detect type mismatch', function(done) {
        const as = $as();
        as.add(
            (as) => {
                const ccm = new AdvancedCCM();
                AutoConfig(as, ccm, {
                    default: {
                        type: ['mysql', 'postgresql'],
                    }
                }, {
                    DB_TYPE: 'somesql',
                    DB_HOST: '127.0.0.1',
                    DB_PORT: '3306',
                    DB_USER: 'ftntest',
                    DB_MAXCONN: '3',
                });
                as.add( (as) => as.error('Fail') );
            },
            (as, err) => {
                if (err === 'InternalError' &&
                    as.state.error_info === 'DB type mismatch for default: mysql,postgresql != somesql')
                {
                    as.success();
                } else {
                    console.log(`${err}: ${as.state.error_info}`);
                    done(as.state.last_exception);
                }
            }
        );
        as.add(
            (as) => {
                const ccm = new AdvancedCCM();
                AutoConfig(as, ccm, {
                    default: {
                        type: 'mysql',
                    }
                }, {
                    DB_TYPE: 'postgresql',
                    DB_HOST: '127.0.0.1',
                    DB_PORT: '3306',
                    DB_USER: 'ftntest',
                    DB_MAXCONN: '3',
                });
                as.add( (as) => as.error('Fail') );
            },
            (as, err) => {
                if (err === 'InternalError' &&
                    as.state.error_info === 'DB type mismatch for default: mysql != postgresql')
                {
                    as.success();
                    done();
                } else {
                    console.log(`${err}: ${as.state.error_info}`);
                    done(as.state.last_exception);
                }
            }
        );
        as.execute();
    });
    
    it('should detect invalid factory', function(done) {
        const as = $as();
        as.add(
            (as) => {
                AutoConfig.register('invfactory', {} );
                const ccm = new AdvancedCCM();
                AutoConfig(as, ccm, null, {
                    DB_TYPE: 'invfactory',
                });
                as.add( (as) => as.error('Fail') );
            },
            (as, err) => {
                if (err === 'InternalError' &&
                    as.state.error_info === 'Unknown factory type [object Object] for invfactory')
                {
                    as.success();
                    done();
                } else {
                    console.log(`${err}: ${as.state.error_info}`);
                    done(as.state.last_exception);
                }
            }
        );
        as.execute();
    });
    
    it('should detect invalid service', function(done) {
        const as = $as();
        as.add(
            (as) => {
                AutoConfig.register('invfactory', class extends require('../L1Service') {
                    static register() {
                        return {};
                    }
                } );
                
                const ccm = new AdvancedCCM();
                AutoConfig(as, ccm, null, {
                    DB_TYPE: 'invfactory',
                });
                as.add( (as) => as.error('Fail') );
            },
            (as, err) => {
                if (err === 'InternalError' &&
                    as.state.error_info === 'Unknown service type "object" for default')
                {
                    as.success();
                    done();
                } else {
                    console.log(`${err}: ${as.state.error_info}`);
                    done(as.state.last_exception);
                }
            }
        );
        as.execute();
    });
    
    it('should properly fallback to DB_PORT', function(done) {
        const as = $as();
        as.add(
            (as) => {
                AutoConfig.register('mock', function() {
                    const L2Service = require('../L2Service');
                    return class extends L2Service {
                        constructor(options) {
                            super();
                            expect(options.type).to.equal('mock');
                            expect(options.port).to.equal(1234);
                            expect(options.conn_limit).to.equal(123);
                        }
                        
                        getFlavour(as, reqinfo) {
                            return 'mock';
                        }
                    };
                });
                
                const ccm = new AdvancedCCM();
                AutoConfig(as, ccm, null, {
                    DB_TYPE: 'mock',
                    DB_PORT: '1234',
                    DB_MAXCONN: '123',
                });
                as.add( (as) => done() );
            },
            (as, err) => {
                console.log(`${err}: ${as.state.error_info}`);
                done(as.state.last_exception);
            }
        );
        as.execute();
    });
});
