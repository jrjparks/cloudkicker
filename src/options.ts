export interface ICloudKickerOptions {
  userAgent: string;
}
export class CloudKickerOptions implements ICloudKickerOptions {
  public userAgent: string;
  constructor(userAgent: string) {
    this.userAgent = userAgent;
  }
}
