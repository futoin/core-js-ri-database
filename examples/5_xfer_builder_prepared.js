'use strict';


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
            
            // Next -> run queries
            as.add((as) => {
                const db = ccm.db();
                let q;
                
                // prepare table
                // ---
                db.query(as, 'DROP TABLE IF EXISTS SomeTbl');
                db.query(as, 'CREATE TABLE SomeTbl(' +
                        'id int auto_increment primary key,' +
                        'name varchar(255) unique)');
                
                // create a prepared transaction with builder
                // ---
                const xfer = db.newXfer(); // Read Committed by default
                
                // already known QueryBuilder without execute() call
                xfer.insert('SomeTbl').set('name', xfer.param('n1'));
                xfer.insert('SomeTbl').set('name', xfer.param('n2'));
                
                // Note the the "result" option to include result in
                // overall xfer result
                xfer.select('SomeTbl', {result: true})
                    .get('C', 'COUNT(*)')
                    .forSharedRead(); // another locking example

                // Prepare transaction
                const prepared_xfer = xfer.prepare();
                
                // test data
                const data = [
                    { n1: 'abc', n2: 'xyz' },
                    { n1: 'cba', n2: 'zyx' },
                ];
                data.forEach((params, i) => {
                    // Efficiently execute prepared transaction
                    prepared_xfer.executeAssoc(as, params);

                    as.add((as, results) => {
                        console.log(`Count for ${i}: ${results[0].rows[0].C}`);
                    });
                });
                
                // Count for 0: 2
                // Count for 1: 4
            });
            // Ensure proper shutdown
            as.add((as) => {
                ccm.close();
            });
        },
        // Overall error handler
        (as, err) => {
            console.log(`${err}: ${as.state.error_info}`);
            console.log(as.state.last_exception);
            ccm.close();
        }
    )
    // Start execution
    .execute();
