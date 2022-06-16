/*tslint:disable:no-else-after-return*/
/*tslint:disable:triple-equals*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../core/base-step';
import { FieldDefinition, RunStepResponse, Step, StepDefinition, RecordDefinition } from '../proto/cog_pb';

/**
 * Note: the class name here becomes this step's stepId.
 * @see BaseStep.getId()
 */
export class DiscoverContact extends BaseStep implements StepInterface {

  protected stepName: string = 'Discover fields on an Eloqua contact';
  protected stepExpression: string = 'discover fields on eloqua contact (?<email>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.ACTION;

  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: "Contact's email address",
  }];
  protected expectedRecords: ExpectedRecord[] = [{
    id: 'contact',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'Id',
      type: FieldDefinition.Type.NUMERIC,
      description: "Contact's Eloqua ID",
    }, {
      field: 'CreatedDate',
      type: FieldDefinition.Type.DATETIME,
      description: "Contact's Created Date",
    }, {
      field: 'LastModifiedDate',
      type: FieldDefinition.Type.DATETIME,
      description: "Contact's Last Modified Date",
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step): Promise<RunStepResponse> {
    let apiRes: any;
    const stepData: any = step.getData().toJavaScript();
    const email: string = stepData.email;

    try {
      apiRes = await this.client.searchContactsByEmail(email);
    } catch (e) {
      return this.error('There was a problem connecting to Eloqua: %s', [
        e.toString(),
      ]);
    }

    try {
      if (apiRes.elements.length === 0) {
        return this.fail('No contact found for email %s', [email]);
      } else {
        return this.pass('Successfully Discovered fields on Eloqua contact', [], [this.keyValue('discoverContact', 'Discovered Contact', apiRes.elements[0])]);
      }
    } catch (e) {
      return this.error('There was an error checking the contact: %s', [e.message]);
    }
  }

}

// Exports a duplicate of this class, aliased as "Step"
// See the constructor in src/core/cog.ts to understand why.
export { DiscoverContact as Step };
