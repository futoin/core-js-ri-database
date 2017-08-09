
const expect = require('chai').expect;

describe('QueryBuilder', function() {
    const QueryBuilder = require('../QueryBuilder');
    const L1Face = require('../L1Face');
    
    class MockSQLDriver extends QueryBuilder.SQLDriver {
        _escapeSimple( value )
        {
            switch (typeof value) {
                case 'boolean':
                    return value ? 'TRUE' : 'FALSE';
                    
                case 'string':
                    return `^${value.replace('^', '\^').replace('\\', '\\\\')}^`;
                    
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
    }
    
    const mockFace = new class extends L1Face {
        constructor() {
            super(null, { funcs: {} });
            this._result = null;
        }
        
        query(as, q) {
            as.add((as) => { as.success(this._result); });
        }
    }
    
    let qb = null;
    
    QueryBuilder.addDriver('mocksql', new MockSQLDriver);
    
    const genQB = (type, entity='Table') => {
        return new QueryBuilder(mockFace, 'mocksql', type, entity);
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
            let res = qb.set('a', qb.raw('A + B'))._toQuery();
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
            let res = qb.set('a', qb.raw('A + B'))._toQuery();
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
    })
    
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
});
