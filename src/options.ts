export interface ICloudKickerOptions {
  timeout: number;
  userAgent: string;
}
export class CloudKickerOptions implements ICloudKickerOptions {
  public timeout: number;
  public userAgent: string;
}
export default CloudKickerOptions;
