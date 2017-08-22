'use strict';

const AutoConfig = require('../AutoConfig');
const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
const $as = require('futoin-asyncsteps');

describe('AutoConfig', function() {
    it('should auto-configure connections', function(done) {
        const as = $as();
        as.add(
            (as) => {
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
                    DB_P_MAXCONN: '5',
                    DB_M_TYPE: 'mysql',
                    DB_M_HOST: '127.0.0.1',
                    DB_M_PORT: '3306',
                    DB_M_USER: 'ftntest',
                    DB_M_PASS: '',
                    DB_M_DB: 'mysql',
                    DB_M_MAXCONN: '4',
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
