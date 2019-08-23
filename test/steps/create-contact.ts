import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { Step as ProtoStep, StepDefinition, FieldDefinition, RunStepResponse } from '../../src/proto/cog_pb';
import { Step } from '../../src/steps/create-contact';

chai.use(sinonChai);

describe('CreateContact', () => {
  const expect = chai.expect;
  let protoStep: ProtoStep;
  let stepUnderTest: Step;
  let apiClientStub: any;

  beforeEach(() => {
    // An example of how you can stub/mock API client methods.
    apiClientStub = sinon.stub();
    apiClientStub.createContact = sinon.stub();
    stepUnderTest = new Step(apiClientStub);
    protoStep = new ProtoStep();
  });

  it('should return expected step metadata', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    expect(stepDef.getStepId()).to.equal('CreateContact');
    expect(stepDef.getName()).to.equal('Create an Eloqua contact');
    expect(stepDef.getExpression()).to.equal('create an eloqua contact');
    expect(stepDef.getType()).to.equal(StepDefinition.Type.ACTION);
  });

  it('should return expected step fields', () => {
    const stepDef: StepDefinition = stepUnderTest.getDefinition();
    const fields: any[] = stepDef.getExpectedFieldsList().map((field: FieldDefinition) => {
      return field.toObject();
    });

    // Contact field
    const Contact: any = fields.filter(f => f.key === 'contact')[0];
    expect(Contact.optionality).to.equal(FieldDefinition.Optionality.REQUIRED);
    expect(Contact.type).to.equal(FieldDefinition.Type.MAP);
  });

  it('should respond with pass if API client resolves', async () => {
    const expectedContact = {emailAddress: 'anything@example.com'};

    // Stub a response that matches expectations.
    apiClientStub.createContact.resolves({id: 123});

    // Set step data corresponding to expectations
    protoStep.setData(Struct.fromJavaScript({contact: expectedContact}));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.PASSED);
    expect(apiClientStub.createContact).to.have.been.calledWith(expectedContact);
  });

  it('should respond with error if API client rejects', async () => {
    // Stub a response that does not match expectations.
    apiClientStub.createContact.rejects();

    // Set step data corresponding to expectations
    protoStep.setData(Struct.fromJavaScript({}));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

  it('should respond with error if API client throws error', async () => {
    // Stub a response that throws any exception.
    apiClientStub.createContact.throws();
    protoStep.setData(Struct.fromJavaScript({}));

    const response: RunStepResponse = await stepUnderTest.executeStep(protoStep);
    expect(response.getOutcome()).to.equal(RunStepResponse.Outcome.ERROR);
  });

});
