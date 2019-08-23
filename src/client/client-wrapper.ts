import * as grpc from 'grpc';
import eloqua from 'eloqua';
import { Field } from '../core/base-step';
import { FieldDefinition } from '../proto/cog_pb';
import { EloquaError } from './eloqua-error';

/**
 * This is a wrapper class around the API client for your Cog. An instance of
 * this class is passed to the constructor of each of your steps, and can be
 * accessed on each step as this.client.
 */
export class ClientWrapper {

  /**
   * This is an array of field definitions, each corresponding to a field that
   * your API client requires for authentication. Depending on the underlying
   * system, this could include bearer tokens, basic auth details, endpoints,
   * etc.
   *
   * If your Cog does not require authentication, set this to an empty array.
   */
  public static expectedAuthFields: Field[] = [{
    field: 'companyName',
    type: FieldDefinition.Type.STRING,
    description: 'Company Name',
  }, {
    field: 'username',
    type: FieldDefinition.Type.STRING,
    description: 'Username',
  }, {
    field: 'password',
    type: FieldDefinition.Type.STRING,
    description: 'Password',
  }];

  /**
   * Private instance of the wrapped API client.
   */
  private client: eloqua;

  /**
   * A map of Eloqua Field IDs to Eloqua Field Internal Names. Used to
   * seriralize and deserialize custom fields on contacts.
   */
  private contactFieldMap: Record<string, string>;

  /**
   * Constructs an instance of the ClientWwrapper, authenticating the wrapped
   * client in the process.
   *
   * @param auth - An instance of GRPC Metadata for a given RunStep or RunSteps
   *   call. Will be populated with authentication metadata according to the
   *   expectedAuthFields array defined above.
   *
   * @param clientConstructor - An optional parameter Used only as a means to
   *   simplify automated testing. Should default to the class/constructor of
   *   the underlying/wrapped API client.
   */
  constructor (auth: grpc.Metadata, clientConstructor = eloqua) {
    this.client = new clientConstructor({
      siteName: auth.get('companyName').toString(),
      userName: auth.get('username').toString(),
      password: auth.get('password').toString(),
    });
  }

  /**
   * Attempts to create an Eloqua contact from an object. The provided object
   * may include keys that match internal field names (e.g. C_Field_name), and
   * this method will automatically convert them to the appropriate fields.
   *
   * Resolves to the created Contact record. Field values will be mapped back
   * to keys on the provided object, just as provided.
   */
  public async createContact(contact: Record<string, any>): Promise<Record<string, any>> {
    try {
      const serializedContact = await this.serializeCustomContactFields(contact);
      // @todo: Contribute this back up.
      const created = await this.client.contacts.client._request({
        data: serializedContact,
        method: 'POST',
        url: '/api/REST/1.0/data/contact',
      });
      return await this.deserializeCustomContactFields(created);
    } catch (e) {
      throw this.handleEloquaError(e);
    }
  }

  /**
   * Attempts to delete an Eloqua contact with the given email address.
   *
   * Resolves the API response of the delete request.
   */
  public async deleteContactByEmail(email: string) {
    try {
      const candidates = await this.searchContactsByEmail(email);
      // @todo: Contribute this back up.
      return await this.client.contacts.client._request({
        method: 'DELETE',
        url: `/api/REST/1.0/data/contact/${candidates.elements[0].id}`,
      });
    } catch (e) {
      throw this.handleEloquaError(e);
    }
  }

  /**
   * @todo
   */
  public async searchContactsByEmail(email: string): Promise<any> {
    const results = await this.client.contacts.getAll({
      depth: 'complete',
      search: `email=${email}`,
    });

    if (results.elements && results.elements.length) {
      // Ensure custom fields are available on the record.
      await Promise.all(results.elements.map((contact, i) => {
        return new Promise(async (resolve) => {
          results.elements[i] = await this.deserializeCustomContactFields(contact);
          resolve();
        });
      }));
    }

    return results;
  }

  /**
   * Wraps the provided error in our own custom error handler, which has a
   * custom toString method for friendlier error display.
   */
  protected handleEloquaError(e: any): EloquaError {
    const eloquaError = new EloquaError();
    eloquaError.name = e.name;
    eloquaError.stack = e.stack;
    eloquaError.message = e.message;
    eloquaError.status = e.status;
    eloquaError.data = e.data;
    return eloquaError;
  }

  /**
   * Given a raw contact record from the Eloqua API, translates all custom
   * fields stored on the fieldValues property into direct properties on the
   * contact record.
   */
  protected async deserializeCustomContactFields(
    rawContact: Record<string, any>,
  ): Promise<Record<string, any>> {
    const returnContact = JSON.parse(JSON.stringify(rawContact));
    await this.populateContactFieldCache();

    // If the contact object has a fieldValues array, decorate the Contact
    // record with all underlying custom fields, keyed on the internal name.
    if (returnContact.fieldValues && returnContact.fieldValues.length) {
      returnContact.fieldValues.forEach((field) => {
        if (field.value && this.contactFieldMap[field.id]) {
          returnContact[this.contactFieldMap[field.id]] = field.value;
        }
      });
    }

    // Remove the fieldValues array from the record.
    delete returnContact.fieldValues;

    return returnContact;
  }

  /**
   * Creates a Contact record suitable for use when interfacing with the Eloqua
   * API. Specifically: adds contact.fieldValues[] records for any custom field
   * supplied as a property on the given contact object.
   */
  protected async serializeCustomContactFields(
    contact: Record<string, any>,
  ): Promise<Record<string, any>> {
    const returnContact = JSON.parse(JSON.stringify(contact));
    await this.populateContactFieldCache();

    Object.keys(returnContact).forEach((field) => {
      const key = Object.keys(this.contactFieldMap).find((key) => {
        return this.contactFieldMap[key] === field;
      });

      if (key) {
        returnContact.fieldValues = returnContact.fieldValues || [];
        returnContact.fieldValues.push({
          type: 'FieldValue',
          id: key,
          value: returnContact[field],
        });
        delete returnContact[field];
      }
    });

    return returnContact;
  }

  /**
   * Sets a map of Eloqua Contact custom field IDs to internal names on this
   * client wrapper. This map is used to serialize/deserialize contact records.
   *
   * Only runs once per instance of the client wrapper.
   *
   * @see this.serializeCustomContactFields()
   * @see this.deserializeCustomContactFields();
   */
  protected async populateContactFieldCache() {
    if (!this.contactFieldMap) {
      try {
        const fields = await this.client.contacts.fields.getAll({ depth: 'partial' });
        this.contactFieldMap = {};
        fields.elements.forEach((field) => {
          this.contactFieldMap[field.id] = field.internalName;
        });
      } catch (e) {
        this.contactFieldMap = {};
      }
    }
  }

}
