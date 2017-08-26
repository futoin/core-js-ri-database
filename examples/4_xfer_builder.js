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
                
                // create a transaction with builder
                // ---
                const xfer = db.newXfer(); // Read Committed by default
                
                // already known QueryBuilder without execute() call
                xfer.insert('SomeTbl').set('name', 'abc');
                xfer.insert('SomeTbl').set('name', 'xyz');
                
                // Note the the "result" option to include result in
                // overall xfer result
                xfer.select('SomeTbl', {result: true})
                    .get('C', 'COUNT(*)')
                    // add FOR-clause, if supported by DB
                    .forUpdate();
                
                // Return result of update and check that any rows are affected
                xfer.update('SomeTbl', {result: true, affected: true})
                    .set('name', 'klm').where('name', 'xyz');
                    
                // Run again making sure zero rows are affected
                xfer.update('SomeTbl', {affected: 0})
                    .set('name', 'klm').where('name', 'xyz');

                // Execute of transaction itself
                xfer.executeAssoc(as);
                
                as.add((as, results) => {
                    console.log(`Count: ${results[0].rows[0].C}`);
                    console.log(`First UPDATE affected: ${results[1].affected}`);
                });
                
                // Count: 2
                // First UPDATE affected: 1
                
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
