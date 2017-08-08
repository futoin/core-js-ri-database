
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
            let qb = new QueryBuilder(mockFace, 'mocksql', 'delete', 'Table');
            let res = qb._toQuery();
            expect(res).to.equal('DELETE FROM Table');
        });
        
        it('should generate conditional statement', function() {
            let qb = new QueryBuilder(mockFace, 'mocksql', 'delete', 'Table');
            let res = qb.where('val IS NULL')._toQuery();
            expect(res).to.equal('DELETE FROM Table WHERE val IS NULL');
        });
        
        it('should generate complex statement', function() {
            let qb = new QueryBuilder(mockFace, 'mocksql', 'delete', 'Table');
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
                ' AND ((TRUE AND 1) OR FALSE)');
        });
    })
    
    describe('INSERT', function() {
    })
    
    describe('UPDATE', function() {
    })
    
    describe('SELECT', function() {
    })
});
