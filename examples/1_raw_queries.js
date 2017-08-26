'use strict';

/**
 * Process ENV variables:
 * 
 * DB_TYPE=mysql
 * DB_HOST=127.0.0.1
 * DB_PORT=3306
 * DB_USER=testuser
 * DB_PASS=testpass
 * DB_DB=testdb
 * DB_MAXCONN=10
 */

const $as = require('futoin-asyncsteps');
const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
const DBAutoConfig = require('../AutoConfig');

$as() // Root FutoIn AsyncSteps
    .add(
        // Root step body
        (as) => {
            // Setup main application CCM
            const ccm = new AdvancedCCM();
            // Configure default connection based on environment variables
            DBAutoConfig(as, ccm);
            
            // Next -> do query
            as.add((as) => {
                ccm.db().query(as, 'SELECT 1+2 AS Sum');
            });
            // Next -> handle result
            as.add((as, res) => {
                res = ccm.db().associateResult(res);
                console.log(`Sum: ${res[0].Sum}`);
            });
            // Ensure proper shutdown
            // All DB pools are automatically closed
            as.add((as) => {
                ccm.close();
            });
        },
        // Overall error handler
        (as, err) => {
            console.log(`${err}: ${as.state.error_info}`);
            console.log(as.state.last_exception);
        }
    )
    // Start execution
    .execute();
