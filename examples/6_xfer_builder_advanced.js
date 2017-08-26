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
                
                // create a prepared transaction with value back references
                // ---
                const xfer = db.newXfer(db.SERIALIZABLE);
                
                // Insert some parametrized data
                const ins1_q = xfer.insert('SomeTbl')
                    .set('name', xfer.param('n1'))
                    .getInsertID('id');
                const ins2_q = xfer.insert('SomeTbl')
                    .set('name', xfer.param('n2'))
                    .getInsertID('id');
                
                // Ensure two items are selected with brain-damaged conditions
                const sel_q = xfer.select('SomeTbl', {selected: 2});
                sel_q
                    .get('id')
                    .where([
                        'OR',
                        {'name': xfer.param('n1')},
                        'id = ' + sel_q.backref(ins2_q, '$id'), // note object of .backref()
                    ])
                    .forUpdate();
                    
                // Make sure one row is updated with brain-damaged conditions
                const upd_q = xfer.update('SomeTbl', {affected: 1});
                upd_q
                    .set('name',
                         upd_q.expr(`CONCAT('klm', ${upd_q.backref(ins1_q, '$id')})`))
                    .where('id IN', upd_q.backref(sel_q, 'id', true))
                    .where('name', xfer.param('n1'));

                // Prepare transaction
                const prepared_xfer = xfer.prepare();
                
                // test data
                // ---
                const data = [
                    { n1: 'abc', n2: 'xyz' },
                    { n1: 'cba', n2: 'zyx' },
                ];
                data.forEach((params, i) => {
                    // Efficiently execute prepared transaction
                    prepared_xfer.executeAssoc(as, params);
                });
                
                // Let's see what we have
                // ---
                db.select('SomeTbl').executeAssoc(as);
                as.add((as, res) => console.log(res));
                
                // [ { id: 1, name: 'klm1' },
                //   { id: 3, name: 'klm3' },
                //   { id: 2, name: 'xyz' },
                //   { id: 4, name: 'zyx' } ]
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
