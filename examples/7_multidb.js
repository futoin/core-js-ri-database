'use strict';

/**
 * Process ENV variables:
 * 
 * DB_FIRST_TYPE=mysql
 * DB_FIRST_HOST=127.0.0.1
 * DB_FIRST_PORT=3306
 * DB_FIRST_USER=testuser
 * DB_FIRST_PASS=testpass
 * DB_FIRST_DB=testdb
 * DB_FIRST_MAXCONN=10
 * 
 * DB_SECOND_TYPE=postgresql
 * DB_SECOND_HOST=127.0.0.1
 * DB_SECOND_PORT=5432
 * DB_SECOND_USER=testuser
 * DB_SECOND_PASS=testpass
 * DB_SECOND_DB=testdb
 * DB_SECOND_MAXCONN=10
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
            // Configure required connections based on environment variables
            DBAutoConfig(as, ccm, {
                first: {},
                second: {},
            });
            
            // Next -> do query
            as.add((as) => {
                ccm.db('first').query(as, 'SELECT 1+2 AS Sum');
                as.add((as, res) => console.log(`First: ${res.rows[0][0]}`));
                
                ccm.db('second').query(as, 'SELECT 3+2 AS Sum');
                as.add((as, res) => console.log(`Second: ${res.rows[0][0]}`));
                
                // First: 3
                // Second: 5
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
