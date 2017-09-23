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
                
                // create a prepared statement with query builder using L1Face#getPrepared()
                // ---
                const sym = Symbol('arbitrary');
                
                for (let nm of ['abc', 'klm', 'xyz']) {
                    const prepared_q = db.getPrepared(sym, (db) => {
                        // executed once
                        const qb = db.insert('SomeTbl');
                        return qb.set('name', qb.param('nm'))
                            .getInsertID('id')
                            .prepare();
                    });
                    
                    // prepared_q is not QueryBuilder, but Prepared object
                    prepared_q.executeAssoc(as, {nm});
                    as.add((as, res) =>
                        console.log(`Inserted ${nm} ID ${res[0].$id}`));
                }
                
                // Inserted abc ID 1
                // Inserted klm ID 2
                // Inserted xyz ID 3
                
                // raw param query
                // ---
                // Not recommended raw example  with the same execution speed
                const raw_q = `INSERT INTO SomeTbl SET name = :nm`;
                
                for (let nm of ['abc2', 'klm2', 'xyz2']) {
                    db.paramQuery(as, raw_q, {nm});
                    as.add((as, res) =>
                        console.log(`Inserted ${nm} ID ${res.rows[0][0]}`));
                }

                // Inserted abc2 ID 4
                // Inserted klm2 ID 5
                // Inserted xyz2 ID 6
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
