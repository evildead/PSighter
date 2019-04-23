// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
const chai = require('chai');
const chaiHttp = require('chai-http');
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;

chai.use(chaiHttp);

const {PSighter} = require('../lib/PSighter');

// PSighter class
describe('PSighter class', () => {
    it('class well formed', () => {
        assert.isDefined(PSighter);
        assert.isNotNull(PSighter);
        expect(PSighter).to.have.property('PSHOSTNAME');
        expect(PSighter).to.have.property('PSLOGINURL');
    });

    it('The constructor invoked no parameters should return an exception: value required', () => {
        expect(() => new PSighter()).to.throw(Error, /^username and pw are required$/);
    });

    it('The constructor invoked with username and password should not return an exception', () => {
        expect(() => new PSighter('test', 'test')).not.to.throw(Error, /^username and pw are required$/);
    });

    it('downloadCourse method exists', () => {
        let pSighter = new PSighter('test', 'test');
        (typeof(pSighter.downloadCourse)).should.equals('function');
    });
});
