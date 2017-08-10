
const expect = require('chai').expect;
const $as = require('futoin-asyncsteps');

const QueryBuilder = require('../QueryBuilder');

class MockSQLDriver extends QueryBuilder.SQLDriver {
    _escapeSimple( value )
    {
        switch (typeof value) {
            case 'boolean':
                return value ? 'TRUE' : 'FALSE';
                
            case 'string':
                return `^${value.replace(/\^/g, '\\^').replace(/\\/g, '\\\\')}^`;
                
            case 'number':
                return `${value}`;
                
            default:
                if (value === null) {
                    return 'NULL';
                }
        
                if (value instanceof QueryBuilder.Expression)
                {
                    return value.toQuery();
                }
                
                throw new Error(`Unknown type: ${typeof value}`);
        }
    }
};

describe('QueryBuilder', function() {
    const L1Face = require('../L1Face');
    
    const mockFace = new class extends L1Face {
        constructor() {
            super(null, { funcs: {} });
            this._result = null;
            this._db_type = 'mocksql';
        }
        
        query(as, q) {
            as.add((as) => { as.success(this._result); });
        }
    }
    
    QueryBuilder.addDriver('mocksql', new MockSQLDriver);
    
    const genQB = (type, entity='Table') => {
        return mockFace.queryBuilder(type, entity);
    }
    
    beforeEach(function(){
        mockFace._result = {
            rows: [
                [1, 'a', true],
                [2, 'b', false],
                [3, 'c', null],
            ],
            fields: [ 'id', 'alpha', 'val' ],
            affected_rows: 21,
        };
    });
    
    
    describe('DELETE', function() {
        it('should generate simple statement', function() {
            let qb = genQB('delete');
            let res = qb._toQuery();
            expect(res).to.equal('DELETE FROM Table');
        });
        
        it('should generate conditional statement', function() {
            let qb = genQB('dELEte');
            let res = qb.where('val IS NULL')._toQuery();
            expect(res).to.equal('DELETE FROM Table WHERE val IS NULL');
        });
        
        it('should detect invalid queries', function() {
            let qb = genQB('delete');       
            
            expect(() => {
                genQB('delete', null)._toQuery();
            }).to.throw('Entity is not set');
            
            expect(() => {
                qb.clone().where('val IS NULL').get('f')._toQuery();
            }).to.throw('Unused map "select"');
            
            expect(() => {
                qb.clone().where('val IS NULL').set('f', 'a')._toQuery();
            }).to.throw('Unused map "toset"');
            
            expect(() => {
                qb.clone().where('val IS NULL').group('expr')._toQuery();
            }).to.throw('Unused array "group"');
            
            expect(() => {
                qb.clone().where('val IS NULL').having('expr')._toQuery();
            }).to.throw('Unused array "having"');
            
            expect(() => {
                qb.clone().where('val IS NULL').order('expr')._toQuery();
            }).to.throw('Unused array "order"');
            
            expect(() => {
                qb.clone().where('val IS NULL').limit(10)._toQuery();
            }).to.throw('Unused array "limit"');
            
            expect(() => {
                qb.clone().where('val IS NULL').leftJoin('Other')._toQuery();
            }).to.throw('Unused array "joins"');
        });
    })
    
    describe('INSERT', function() {
        it('should generate simple statement', function() {
            let qb = genQB('insert');
            let res = qb.set('a', 'b')._toQuery();
            expect(res).to.equal('INSERT INTO Table (a) VALUES (^b^)');
            
            res = qb.set('a', 'b').set({ d: 'D', c: 'C'})._toQuery();
            expect(res).to.equal('INSERT INTO Table (a,d,c) VALUES (^b^,^D^,^C^)');
        });
        
        it('should generate complex statement', function() {
            let qb = genQB('inSeRt');
            let res = qb.set('a', qb.expr('A + B'))._toQuery();
            expect(res).to.equal('INSERT INTO Table (a) VALUES (A + B)');
            
            res = qb.set('b', genQB('select', 'Other'))._toQuery();
            expect(res).to.equal(
                'INSERT INTO Table (a,b) ' +
                'VALUES (A + B,(SELECT * FROM Other))');
        });
        
        it('should generate INSERT-SELECT statement', function() {
            let sqb = genQB('select', 'Other');
            sqb.get({a: 'A', b: 'B'});
            let res = genQB('insert').set(sqb)._toQuery();
            expect(res).to.equal(
                'INSERT INTO Table (a,b) '+
                'SELECT A AS a,B AS b FROM Other');
        });
        
        it('should detect invalid queries', function() {
            let qb = genQB('insert');
            
            expect(() => {
                genQB('insert', null)._toQuery();
            }).to.throw('Entity is not set');
            
            expect(() => {
                qb.clone()._toQuery();
            }).to.throw('Nothing to set');
            
            expect(() => {
                qb.clone().set('a', 'A').get('f')._toQuery();
            }).to.throw('Unused map "select"');
            
            expect(() => {
                qb.clone().set('a', 'A').where({'f': 'a'})._toQuery();
            }).to.throw('Unused array "where"');
            
            expect(() => {
                qb.clone().set('a', 'A').group('expr')._toQuery();
            }).to.throw('Unused array "group"');
            
            expect(() => {
                qb.clone().set('a', 'A').having('expr')._toQuery();
            }).to.throw('Unused array "having"');
            
            expect(() => {
                qb.clone().set('a', 'A').order('expr')._toQuery();
            }).to.throw('Unused array "order"');
            
            expect(() => {
                qb.clone().set('a', 'A').limit(10)._toQuery();
            }).to.throw('Unused array "limit"');
            
            expect(() => {
                qb.clone().set('a', 'A').leftJoin('Other')._toQuery();
            }).to.throw('Unused array "joins"');
            
            expect(() => {
                qb.clone().set('a', 'A').set(genQB('select'))._toQuery();
            }).to.throw('INSERT-SELECT can not be mixed with others');

            expect(() => {
                qb.clone().set(genQB('select')).set('a', 'A')._toQuery();
            }).to.throw('INSERT-SELECT can not be mixed with others');
            
            expect(() => {
                qb.clone().set(genQB('delete'))._toQuery();
            }).to.throw('Not a SELECT sub-query');            
        });
    })
    
    describe('UPDATE', function() {
        it('should generate simple statement', function() {
            let qb = genQB('update');
            let res = qb.set('a', 'b')._toQuery();
            expect(res).to.equal('UPDATE Table SET a=^b^');
            
            res = qb.set('a', 'b').set({ d: 'D', c: 'C'})._toQuery();
            expect(res).to.equal('UPDATE Table SET a=^b^,d=^D^,c=^C^');
        });
        
        it('should generate complex statement', function() {
            let qb = genQB('upDaTe');
            let res = qb.set('a', qb.expr('A + B'))._toQuery();
            expect(res).to.equal('UPDATE Table SET a=A + B');
            
            res = qb.set('b', genQB('select', 'Other'))._toQuery();
            expect(res).to.equal(
                'UPDATE Table SET a=A + B,b=(SELECT * FROM Other)');
        });
        
        
        it('should detect invalid queries', function() {
            let qb = genQB('update');   
            
            expect(() => {
                genQB('update', null)._toQuery();
            }).to.throw('Entity is not set');
            
            expect(() => {
                qb.clone()._toQuery();
            }).to.throw('Nothing to set');
                        
            expect(() => {
                qb.clone().set('a', 'A').get('f')._toQuery();
            }).to.throw('Unused map "select"');
            
            expect(() => {
                qb.clone().set('a', 'A').group('expr')._toQuery();
            }).to.throw('Unused array "group"');
            
            expect(() => {
                qb.clone().set('a', 'A').having('expr')._toQuery();
            }).to.throw('Unused array "having"');
            
            expect(() => {
                qb.clone().set('a', 'A').order('expr')._toQuery();
            }).to.throw('Unused array "order"');
            
            expect(() => {
                qb.clone().set('a', 'A').limit(10)._toQuery();
            }).to.throw('Unused array "limit"');
            
            expect(() => {
                qb.clone().set('a', 'A').leftJoin('Other')._toQuery();
            }).to.throw('Unused array "joins"');
            
            expect(() => {
                qb.clone().set(genQB('select'))._toQuery();
            }).to.throw('Not an INSERT query for INSERT-SELECT');
        });
    })
    
    describe('SELECT', function() {
        it('should generate simple statement', function() {
            let qb = genQB('select', null);
            res = qb
                .get('a')
                .get(['c', 'b'])
                .get({
                    d: 'D',
                    q: genQB('select').get('r'),
                })
                ._toQuery();
            expect(res).to.equal('SELECT a,c,b,D AS d,(SELECT r FROM Table) AS q');
        });
        
        it('should generate complex statement', function() {
            let qb = genQB('select', ['SomeTable', 'ST']);
            let res = qb
                .get('ST.*')
                .get('OtherInner.F')
                .get('G', 'SUM(OtherLeft.C)')
                .innerJoin('OtherInner')
                .leftJoin(['OtherLeft', 'OL'], [ 'OL.X == OtherInner.Y' ])
                .leftJoin([genQB('select', null).get('f', '1'), 'QL'])
                .where('OtherInner.SF IN', [1,2,3])
                .group('ST.G1').group('OtherInner.Y')
                .having(['OR', 'G IS NULL', { 'G <': 0 } ])
                .order('G').order('RAND()')
                .limit(10, 1)
                ._toQuery();
            expect(res).to.equal(
                'SELECT ST.*,OtherInner.F,SUM(OtherLeft.C) AS G ' +
                'FROM SomeTable AS ST ' +
                'INNER JOIN OtherInner ' +
                'LEFT JOIN OtherLeft AS OL ON OL.X == OtherInner.Y ' +
                'LEFT JOIN (SELECT 1 AS f) AS QL '+
                'WHERE OtherInner.SF IN (1,2,3) ' +
                'GROUP BY ST.G1,OtherInner.Y ' +
                'HAVING (G IS NULL OR G < 0) ' +
                'ORDER BY G ASC,RAND() ASC ' +
                'LIMIT 10 OFFSET 1');
        });
        
        it('should detect invalid queries', function() {
            let qb = genQB('select');       

            expect(() => {
                qb.clone().where('val IS NULL').set('f', 'a')._toQuery();
            }).to.throw('Unused map "toset"');
        });
    });
    
    describe('CALL', function() {
        it('should generate simple statement', function() {
            let qb = genQB('Call', 'Prc')._callParams([123, 'abc', true]);
            res = qb._toQuery();
            expect(res).to.equal('CALL Prc(123,^abc^,TRUE)');
        });
    });
    
    describe('Conditions', function() {
        it('should generate complex statement', function() {
            let qb = genQB('DELETE');
            let res = qb
                .where('val IS NULL')
                .where({
                    'a' : 1,
                    'c <>' : false,
                    'b LIKE ' : 'bb%',
                })
                .where(new Map([
                    ['d <=', 4],
                    ['e IN', [1, 2, 3]],
                    ['f BETWEEN', [1, 'a']],
                ]))
                .where([
                    'OR',
                    ['AND', 'TRUE', '1'],
                    ['FALSE'],
                    {
                        f: (new QueryBuilder(mockFace, 'mocksql', 'select'))
                            .get({'res': 'F()'})
                    }
                ])
                ._toQuery();
            expect(res).to.equal(
                'DELETE FROM Table ' +
                'WHERE val IS NULL' +
                ' AND a = 1' +
                ' AND c <> FALSE' +
                ' AND b LIKE ^bb%^' +
                ' AND d <= 4' +
                ' AND e IN (1,2,3)' +
                ' AND f BETWEEN 1 AND ^a^' +
                ' AND ((TRUE AND 1) OR FALSE OR f = (SELECT F() AS res))');
        });
    });
    
    describe('#execute', function(){
        beforeEach(function(){
            mockFace._result = {
                rows: [ [1, 'aaa'], [2, 'bb'], [3, 'c'] ],
                fields: [ 'id', 'name' ],
                affected: 123,
            };
        });
        
        it('should execute and return raw result', function(done) {
            const as = $as();
            
            as.add(
                (as) => {
                    mockFace.select('SomeTable').execute(as);
                    as.add((as, res) => {
                        expect(res).to.eql(mockFace._result);
                    });
                },
                (as, err) => {
                    console.log(as.state.error_info);
                    done(as.state.last_exception || err);
                }
            )
            .add((as) => done())
            .execute();
        });
        
        
        it('should execute and return associative result', function(done) {
            const as = $as();
            
            as.add(
                (as) => {
                    mockFace.select('SomeTable').executeAssoc(as);
                    as.add((as, res, affected) => {
                        expect(res).to.eql([
                            { id: 1, name: 'aaa' },
                            { id: 2, name: 'bb' },
                            { id: 3, name: 'c' },
                        ]);
                        expect(affected, 123);
                    });
                },
                (as, err) => {
                    console.log(as.state.error_info);
                    done(as.state.last_exception || err);
                }
            )
            .add((as) => done())
            .execute();
        });
    });
    
    describe('#_replaceParams', function(){
        if('should properly handle placeholders', function(){
            let qb = genQB('select');
            
            expect(
                qb._replaceParams('Some :v :vv :vvv :v', { v: 3, vv: 2, vvv: 1})
            ).to.equal('Some 3 2 1 3');
        });
    });
});

describe('XferBuilder', function() {
    const XferBuilder = require('../XferBuilder');
    const L2Face = require('../L2Face');
    
    const mockFace = new class extends L2Face {
        constructor() {
            super(null, { funcs: {} });
            this._qresult = null;
            this._xresult = null;
            this._db_type = 'mocksql';
        }
        
        query(as, q) {
            as.add((as) => { as.success(this._qresult); });
        }

        xfer(as, ql, iso_level) {
            if (typeof as === 'function') {
                as(ql, iso_level);
            } else {
                as.add((as) => { as.success(this._xresult); });
            }
        }
    }
    
    QueryBuilder.addDriver('mocksql', new MockSQLDriver);
    
    it('should have correct constants', function(){
        expect(mockFace.READ_UNCOMMITTED).to.equal('RU');
        expect(mockFace.READ_COMMITTED).to.equal('RC');
        expect(mockFace.REPEATABL_READ).to.equal('RR');
        expect(mockFace.SERIALIZABLE).to.equal('SRL');
    });
    
    it('should build transactions', function(){
        let xb;
        
        xb = mockFace.newXfer()
        xb.select(['Tab', 'T'], {result: true}).get('a', 'RAND()');
        xb.update('Tab', { affected: 1 }).set('a', mockFace.select('Other').get('b'));
        xb.insert('Other').set('l', 'ABC');
        xb.delete('Other').where('l', 'Zzz');
        xb.call('Prc', [123, 'abc', true]);
        xb.raw('Something Cazy :b, :a', { a: 1, b: 'c'});
        xb.execute(function(ql, isol){
            expect(isol).to.equal('RC');
            expect(ql).to.eql([
                { q: 'SELECT RAND() AS a FROM Tab AS T',
                  result: true },
                { q: 'UPDATE Tab SET a=(SELECT b FROM Other)',
                  affected: 1 },
                { q: 'INSERT INTO Other (l) VALUES (^ABC^)' },
                { q: 'DELETE FROM Other WHERE l = ^Zzz^' },
                { q: 'CALL Prc(123,^abc^,TRUE)' },
                { q: 'Something Cazy ^c^, 1' },
            ]);
        }, true);
    });
    
});
