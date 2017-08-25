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
                
                // insert some data
                // ---
                // - simple set
                db.insert('SomeTbl').set('name', 'abc').execute(as);
                // - set as object key=>value pairs
                db.insert('SomeTbl').set({name: 'klm'}).execute(as);
                // - set with Map key=>value pairs
                db.insert('SomeTbl')
                    .set(new Map([['name', 'xyz']]))
                    .getInsertID('id')
                    .executeAssoc(as);
                // use insert ID
                as.add((as, res, affected) => console.log(`Insert ID: ${res[0].$id}`));
                
                // INSERT-SELECT like query
                // ---
                // sub-query must be the only parameter for .set()
                db.insert('SomeTbl').set(
                    // DANGER: .get() expects expressions and does not escape them!
                    db.select('SomeTbl').get('name', "CONCAT('INS', name)").where('id <', 3)
                ).execute(as);
                
                // update data
                const qb = db.queryBuilder(); // generic query builder for helper API
                
                q = db.update('SomeTbl')
                    // - .set can be called multiple times
                    .set('id', 10)
                    // - please note that set auto-escapes all values, unless wrapped with .expr()
                    .set('name', qb.expr('CONCAT(id, name)'))
                    // - simple condition
                    .where('name', 'klm')
                    // - extra calls are implicit "AND"
                    // - Most powerful array-based definition which is
                    //      very close to how all conditions are handled internally.
                    .where([
                        'OR', // The scope of OR is only children of this array
                        // object as member, all fields are AND assumed
                        {
                            // there are various generic suppported operators
                            'name LIKE': 'kl%',
                            // another example
                            'id >': 1,
                        },
                        // Inner complex array
                        [
                            'AND', // this can be omitted as "AND" is implicit for arrays
                            // raw expression as string - DANGER of SQLi, please avoid
                            'name NOT LIKE \'xy%\'',
                            // another example of operator with two values
                            { 'id BETWEEN': [1, 10] }
                        ],
                        // Note: Map object can also be used
                    ]);

                // Dump raw query for inspection
                console.log(`Query: ${q}`);
                // UPDATE SomeTbl SET id=10,name=CONCAT(id, name) WHERE name = 'klm' AND (name LIKE 'kl%' OR id > 1 OR (name NOT LIKE 'xy%' AND id BETWEEN 1 AND 10))
                
                // Finally, execute it
                q.execute(as);

                // Select without entity
                // ---
                db.select().get('atm', 'NOW()').executeAssoc(as);
                as.add((as, res) => console.log(`At the moment: ${res[0].atm}`));
                
                // Select with join of result of sub-query (instead of normal table)
                // ---
                q = db.select('SomeTbl')
                    .innerJoin(
                        // sub-query
                        // NOTE: use of .escape() for .get()
                        [ db.select().get('addr', qb.escape('Street 123')), 'Alias'],
                        // all where-like conditions are supported here
                        '1 = 1' // can be omitted
                    );
                console.log(`Query: ${q}`);
                // SELECT * FROM SomeTbl INNER JOIN (SELECT 'Street 123' AS addr) AS Alias ON 1 = 1
                q.executeAssoc(as);
                // inspect result
                as.add((as, res) => console.log(res));
                /*
                 * [
                 *  { id: 10, name: '10klm', addr: 'Street 123' },
                 *  { id: 1, name: 'abc', addr: 'Street 123' },
                 *  { id: 4, name: 'INSabc', addr: 'Street 123' },
                 *  { id: 5, name: 'INSklm', addr: 'Street 123' },
                 *  { id: 3, name: 'xyz', addr: 'Street 123' },
                 * ]
                 */
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
