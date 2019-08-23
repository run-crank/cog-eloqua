import * as chai from 'chai';
import { EloquaError } from "../../src/client/eloqua-error";

describe('EloquaError', () => {
  let expect = chai.expect;
  let errorUnderTest: EloquaError;

  beforeEach(() => {
    errorUnderTest = new EloquaError();
  })

  it('prints standard error by default', () => {
    errorUnderTest.message = 'Any error message';
    expect(errorUnderTest.toString()).to.equal(`Error: ${errorUnderTest.message}`);
  });

  it('prints requirements error when present', () => {
    errorUnderTest.status = 400;
    errorUnderTest.name = 'Validation Error';
    errorUnderTest.data = [{
      type: 'ObjectValidationError',
      property: 'someField',
      requirement: {
        type: 'ValidTextLengthRequirement',
      }
    }];

    const expectedMessage = `${errorUnderTest.name}: ${errorUnderTest.data[0].type} - ${errorUnderTest.data[0].property} did not meet requirement ${errorUnderTest.data[0].requirement.type}`;
    expect(errorUnderTest.toString()).to.equal(expectedMessage);
  });

});
