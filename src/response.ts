import {OptionsWithUrl, RequestResponse} from "request";
export interface ICloudKickerResponse {
  response: RequestResponse;
  options: OptionsWithUrl;
}
export class CloudKickerResponse implements ICloudKickerResponse {
  public response: RequestResponse;
  public options: OptionsWithUrl;
  constructor(response: RequestResponse, options: OptionsWithUrl) {
    this.response = response;
    this.options = options;
  }
}
