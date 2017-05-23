import * as request from "request";
export interface ICloudKickerResponse {
  response: request.RequestResponse;
  options: request.OptionsWithUrl;
}
export class CloudKickerResponse implements ICloudKickerResponse {
  public response: request.RequestResponse;
  public options: request.OptionsWithUrl;
  constructor(response: request.RequestResponse, options: request.OptionsWithUrl) {
    this.response = response;
    this.options = options;
  }
}
export default CloudKickerResponse;
