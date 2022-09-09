/*tslint:disable:no-else-after-return*/
/*tslint:disable:triple-equals*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { FieldDefinition, RunStepResponse, Step, StepDefinition, StepRecord } from '../proto/cog_pb';

/**
 * Note: the class name here becomes this step's stepId.
 * @see BaseStep.getId()
 */
export class CreateContact extends BaseStep implements StepInterface {

  /**
   * The name of this step: used when identifying this step to humans.
   */
  protected stepName: string = 'Create an Eloqua contact';

  /**
   * Type of step (either Action or Validation).
   */
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;

  /**
   * A string that can be evaluated as an ECMAScript-compatible regular expression. This is used to
   * identify and evaluate this step in cucumber-like scenario files. You are encouraged to use
   * named regex capturing groups that correspond to the expected fields below.
   */
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'create an eloqua contact';

  /**
   * An array of Fields that this step expects to be passed via step data. The value of "field"
   * will be used as the field value's key when passed over the step data Struct.
   */
  protected expectedFields: Field[] = [{
    field: 'contact',
    type: FieldDefinition.Type.MAP,
    description: 'A map of field names to field values',
  }];

  async executeStep(step: Step): Promise<RunStepResponse> {
    const stepData: any = step.getData().toJavaScript();
    const contact: Record<string, any> = stepData.contact;

    try {
      const result = await this.client.createContact(contact);
      const records = this.createRecords(contact, stepData['__stepOrder']);
      return this.pass('Successfully created Contact with ID %s', [result.id], records);
    } catch (e) {
      return this.error('There was a problem creating the Contact. %s', [e.toString()]);
    }
  }

  public createRecords(contact, stepOrder = 1): StepRecord[] {
    const records = [];
    // Base Record
    records.push(this.keyValue('contact', 'Created Contact', contact));
    // Ordered Record
    records.push(this.keyValue(`contact.${stepOrder}`, `Created Contact from Step ${stepOrder}`, contact));
    return records;
  }

}

// Exports a duplicate of this class, aliased as "Step"
// See the constructor in src/core/cog.ts to understand why.
export { CreateContact as Step };
