'use strict';

const expect = require('chai').expect;
const $as = require('futoin-asyncsteps');


describe('PostgreSQLDriver', function() {
    const { QueryBuilder } = require('../main');
    const drv = QueryBuilder.getDriver('postgresql');
    
    it('should escape values correctly', () => {
        expect( drv.escape(true) ).to.equal('TRUE');
        expect( drv.escape(false) ).to.equal('FALSE');
        expect( drv.escape(0) ).to.equal('0');
        expect( drv.escape(100) ).to.equal('100');
        expect( drv.escape(-300) ).to.equal('-300');
        expect( drv.escape(1.5) ).to.equal('1.5');
        expect( drv.escape("") ).to.equal("''");
        expect( drv.escape("Some ' string ' \" \\") )
            .to.equal("'Some '' string '' \" \\\\'");
    });
    
    it('should escape identifiers correctly', () => {
        expect( drv.identifier('one') ).to.equal('"one"');
        expect( drv.identifier('one.two') ).to.equal('"one"."two"');
        expect( drv.identifier('on"e.t"w"o') ).to.equal('"on""e"."t""w""o"');
    });
    
    it('should support RETURNING clause', () => {
        let qb;
    
        qb = new QueryBuilder(null, 'postgresql', 'insert', 'tbl');
        qb.set('name', 'abc').get(['id', 'ts']);
        expect( qb._toQuery() )
            .to.equal('INSERT INTO tbl (name) VALUES (\'abc\') RETURNING id,ts');
    
        qb = new QueryBuilder(null, 'postgresql', 'update', 'tbl');
        qb.set('name', 'abc').get(['id', 'ts']).where('name', 'xyz');
        expect( qb._toQuery() )
            .to.equal('UPDATE tbl SET name=\'abc\' WHERE name = \'xyz\' RETURNING id,ts');
    
        qb = new QueryBuilder(null, 'postgresql', 'delete', 'tbl');
        qb.get(['id', 'ts']).where('name', 'xyz');
        expect( qb._toQuery() )
            .to.equal('DELETE FROM tbl WHERE name = \'xyz\' RETURNING id,ts');
    });
});
