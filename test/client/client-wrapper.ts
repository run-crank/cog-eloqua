import * as chai from 'chai';
import { default as sinon } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import 'mocha';

import { ClientWrapper } from '../../src/client/client-wrapper';
import { Metadata } from 'grpc';
import { EloquaError } from '../../src/client/eloqua-error';

chai.use(sinonChai);

describe('ClientWrapper', () => {
  const expect = chai.expect;
  let eloquaConstructorStub: any;
  let eloquaContactsStub: any;
  let metadata: Metadata;
  let clientWrapperUnderTest: ClientWrapper;

  beforeEach(() => {
    eloquaContactsStub = {
      getAll: sinon.stub(),
      client: {
        _request: sinon.stub(),
      },
      fields: {
        getAll: sinon.stub(),
      },
    };
    eloquaContactsStub.fields.getAll.resolves({elements: []});
    eloquaConstructorStub = sinon.stub();
    eloquaConstructorStub.returns({contacts: eloquaContactsStub});
  });

  it('authenticates', () => {
    // Construct grpc metadata and assert the client was authenticated.
    const expectedCallArgs = {
      siteName: 'SomeCompany',
      userName: 'Some.User',
      password: 'some-user-password',
    };
    metadata = new Metadata();
    metadata.add('companyName', expectedCallArgs.siteName);
    metadata.add('username', expectedCallArgs.userName);
    metadata.add('password', expectedCallArgs.password);

    // Assert that the underlying API client was authenticated correctly.
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);
    expect(eloquaConstructorStub).to.have.been.calledWith(expectedCallArgs);
  });

  it('createContact::happypath', async () => {
    // Set up stubs and expected data.
    const expectedContact = {emailAddress: 'test@example.com'};
    const expectedResolution = {id: 123};
    eloquaContactsStub.client._request.resolves(expectedResolution);
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);

    // Call the method and assert expectations.
    const resolvedContact = await clientWrapperUnderTest.createContact(expectedContact);
    expect(eloquaContactsStub.client._request).to.have.been.calledWith({
      data: expectedContact,
      method: 'POST',
      url: '/api/REST/1.0/data/contact',
    });
    expect(resolvedContact).to.deep.equal(expectedResolution);
  });

  it('createContact::serialization', async () => {
    // Set up expected data.
    const expectedContact = {
      emailAddress: 'test@example.com',
      C_Custom_Field: 'custom field value',
    };
    const expectedResolution = {
      emailAddress: expectedContact.emailAddress,
      fieldValues: [{
        id: '10001',
        type: 'FieldValue',
        value: expectedContact.C_Custom_Field,
      }],
    };

    // Stub the getAll fields call to return a single custom field.
    eloquaContactsStub.fields.getAll.resolves({elements: [{
      id: '10001',
      type: 'FieldValue',
      internalName: 'C_Custom_Field',
    }]});

    // Have the contact client resolve a Contact in the API's native form.
    eloquaContactsStub.client._request.resolves(expectedResolution);
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);

    // Call the method and assert expectations.
    const resolvedContact = await clientWrapperUnderTest.createContact((expectedContact));

    // As a result of serialization, despite passing in a friendlier contact
    // object to ClientWrapper.createContact, the API should have received the
    // serialized/translated version.
    expect(eloquaContactsStub.client._request).to.have.been.calledWith({
      data: expectedResolution,
      method: 'POST',
      url: '/api/REST/1.0/data/contact',
    });

    // And despite the API request resolving an API-formatted response, the
    // ClientWrapper.createContact() call to resolve the original format.
    expect(resolvedContact).to.deep.equal(expectedContact);
  });

  it('createContact::apiError', (done) => {
    // Set up stubs and expected data.
    const expectedContact = {emailAddress: 'test@example.com'};
    eloquaContactsStub.client._request.throws();
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);

    // Call the method and assert expectations.
    clientWrapperUnderTest.createContact(expectedContact).catch((e) => {
      expect(e.isEloquaError).to.be.true;
      done();
    });
  });

  it('searchContactsByEmail::happyPath', async () => {
    // Set up stubs and expected data.
    const expectedEmail = 'test@example.com';
    const expectedResult = {elements: [{emailAddress: expectedEmail}]};
    eloquaContactsStub.getAll.resolves(expectedResult);
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);

    // Call the method and assert expectations.
    const searchResult = await clientWrapperUnderTest.searchContactsByEmail(expectedEmail);
    expect(eloquaContactsStub.getAll).to.have.been.calledWith({
      depth: 'complete',
      search: `email=${expectedEmail}`,
    });
    expect(searchResult).to.deep.equal(expectedResult);
  });

  it('searchContactsByEmail::serialization', async () => {
    // Set up stubs and expected data.
    const expectedEmail = 'test@example.com';
    const willedResult = {elements: [{
      emailAddress: expectedEmail,
      fieldValues: [{
        id: '10001',
        type: 'FieldValue',
        value: 'Some Custom Value',
      }],
    }]};
    const expectedResult = {elements: [{
      emailAddress: expectedEmail,
      C_Custom_Field: willedResult.elements[0].fieldValues[0].value,
    }]};

    // Stub the getAll fields call to return a single custom field.
    eloquaContactsStub.fields.getAll.resolves({elements: [{
      id: '10001',
      type: 'FieldValue',
      internalName: 'C_Custom_Field',
    }]});

    // Resolve a record containing custom fields.
    eloquaContactsStub.getAll.resolves(willedResult);

    // Call the method and assert expectations.
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);
    const searchResult = await clientWrapperUnderTest.searchContactsByEmail(expectedEmail);

    // Despite the raw API format being resolved above, the friendlier format
    // should be returned.
    expect(searchResult).to.deep.equal(expectedResult);
  });

  it('searchContactsByEmail::apiError', (done) => {
    const expectedEmail = 'test@example.com';
    eloquaContactsStub.getAll.throws()
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);

    // Call the method and assert expectations.
    clientWrapperUnderTest.searchContactsByEmail(expectedEmail).catch(() => {
      done();
    });
  });

  it('deleteContactByEmail::happyPath', async () => {
    // Set up stubs and expected data.
    const expectedEmail = 'test@example.com';
    const expectedResolution = {elements: [{id: 123}]};
    eloquaContactsStub.client._request.resolves();
    eloquaContactsStub.getAll.resolves(expectedResolution);
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);

    // Call the method and assert expectations.
    await clientWrapperUnderTest.deleteContactByEmail(expectedEmail);
    expect(eloquaContactsStub.client._request).to.have.been.calledWith({
      method: 'DELETE',
      url: `/api/REST/1.0/data/contact/${expectedResolution.elements[0].id}`,
    });
  });

  it('deleteContactByEmail::apiErrorOnFind', (done) => {
    // Set up stubs and expected data.
    const expectedEmail = 'test@example.com';
    eloquaContactsStub.client._request.resolves();
    eloquaContactsStub.getAll.rejects();
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);

    // Call the method and assert expectations.
    clientWrapperUnderTest.deleteContactByEmail(expectedEmail).catch((e) => {
      expect(e.isEloquaError).to.be.true;
      done();
    });
  });

  it('deleteContactByEmail::apiErrorOnDelete', (done) => {
    // Set up stubs and expected data.
    const expectedEmail = 'test@example.com';
    const expectedResolution = {elements: [{id: 123}]};
    eloquaContactsStub.client._request.rejects();
    eloquaContactsStub.getAll.resolves(expectedResolution);
    clientWrapperUnderTest = new ClientWrapper(metadata, eloquaConstructorStub);

    // Call the method and assert expectations.
    clientWrapperUnderTest.deleteContactByEmail(expectedEmail).catch((e) => {
      expect(e.isEloquaError).to.be.true;
      done();
    });
  })

});
