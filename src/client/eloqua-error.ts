export class EloquaError extends Error {

  public isEloquaError: boolean;
  public status: number;
  public data: Record<string, any>[];

  constructor() {
    super(arguments[0]);
    this.isEloquaError = true;
  }

  public toString = () : string => {
    if (this.status && this.status === 400 && this.data) {
      const aggregateError: string = this.data.map((error) => {
        return `${error.type} - ${error.property} did not meet requirement ${error.requirement.type}`;
      }).join('\n');
      return `${this.name}: ${aggregateError}`;
    }

    return super.toString();
  }

}
