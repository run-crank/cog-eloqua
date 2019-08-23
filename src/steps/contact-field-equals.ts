/*tslint:disable:no-else-after-return*/
/*tslint:disable:triple-equals*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { FieldDefinition, RunStepResponse, Step, StepDefinition } from '../proto/cog_pb';

/**
 * Note: the class name here becomes this step's stepId.
 * @see BaseStep.getId()
 */
export class ContactFieldEquals extends BaseStep implements StepInterface {

  /**
   * The name of this step: used when identifying this step to humans.
   */
  protected stepName: string = 'Check a field on an Eloqua contact';

  /**
   * Type of step (either Action or Validation).
   */
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;

  /**
   * A string that can be evaluated as an ECMAScript-compatible regular expression. This is used to
   * identify and evaluate this step in cucumber-like scenario files. You are encouraged to use
   * named regex capturing groups that correspond to the expected fields below.
   */
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>.+) field on eloqua contact (?<email>.+) should be (?<expectedValue>.+)';

  /**
   * An array of Fields that this step expects to be passed via step data. The value of "field"
   * will be used as the field value's key when passed over the step data Struct.
   */
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: "Contact's email address",
  }, {
    field: 'field',
    type: FieldDefinition.Type.STRING,
    description: 'Field name to check',
  }, {
    field: 'expectedValue',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'Expected field value',
  }];

  async executeStep(step: Step): Promise<RunStepResponse> {
    let apiRes: any;
    const stepData: any = step.getData().toJavaScript();
    const email: string = stepData.email;
    const field: string = stepData.field;
    const expectedValue: string = stepData.expectedValue;

    try {
      apiRes = await this.client.searchContactsByEmail(email);
    } catch (e) {
      return this.error('There was a problem connecting to JSON Placeholder.');
    }

    if (apiRes.elements.length === 0) {
      // If no results were found, return an error.
      return this.error('No contact found for email %s', [email]);
    } else if (!apiRes.elements[0].hasOwnProperty(field)) {
      // If the given field does not exist on the user, return an error.
      return this.error('The %s field does not exist on contact %s', [field, email]);
    } else if (apiRes.elements[0][field] == expectedValue) {
      // If the value of the field matches expectations, pass.
      return this.pass('The %s field was set to %s, as expected', [
        field,
        apiRes.elements[0][field],
      ]);
    } else {
      // If the value of the field does not match expectations, fail.
      return this.fail('Expected %s field to be %s, but it was actually %s', [
        field,
        expectedValue,
        apiRes.elements[0][field],
      ]);
    }
  }

}

// Exports a duplicate of this class, aliased as "Step"
// See the constructor in src/core/cog.ts to understand why.
export { ContactFieldEquals as Step };
