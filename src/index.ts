import * as _ from "lodash";
import * as request from "request";
import { Url } from "url";
import { ICloudKickerOptions } from "./options";
import { CloudKickerResponse } from "./response";

import vm = require("vm");
const defaultUserAgent =
  "Mozilla/5.0 (X11: Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36";

export function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export type OnProgressCallback = (progress: number, total: number, ...args: any[]) => void;

export class CloudKicker {
  public cookieJar: request.CookieJar;
  private options: ICloudKickerOptions;

  constructor(options?: ICloudKickerOptions) {
    this.options = _.extend({
      userAgent: defaultUserAgent,
    }, options);
    this.clearCookieJar();
  }

  // Clear the cookieJar
  public clearCookieJar() { this.cookieJar = request.jar(); }

  public async get(
    url: Url | string,
    headers?: request.Headers): Promise<CloudKickerResponse> {
    const options: request.Options = {
      encoding: "utf-8",
      headers: (headers),
      method: "GET",
      url: (url),
    };
    return this.performRequest(options);
  }

  public async post(
    url: Url | string,
    body: any,
    headers?: object): Promise<CloudKickerResponse> {
    headers = _.extend({
      "Content-Length": body.length,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }, headers);
    const options: request.Options = {
      body: (body),
      encoding: "utf-8",
      headers: (headers),
      method: "POST",
      url: (url),
    };
    return this.performRequest(options);
  }

  // Perform a request and handle cloudflare if needed
  public async performRequest(
    options: request.OptionsWithUrl,
    onProgress?: OnProgressCallback): Promise<CloudKickerResponse> {
    options.headers = _.extend({
      "User-Agent": this.options.userAgent,
    }, options.headers);
    options = _.extend({
      encoding: null,
    }, options);
    options.jar = this.cookieJar;
    return new Promise<CloudKickerResponse>((resolve, reject) => {
      if (!options.url) { return reject(new Error("url is not defined")); }

      let receivedBytes: number = 0;
      let totalBytes: number = 0;
      const req = this.request(options, (error, response) => {
        // this.request(options, (error, response) => {
        if (error) { return reject(error); } // If the request errors out reject.
        try { // Test body for errors.
          this.checkForBodyErrors(response.body);
        } catch (bodyError) { return reject(bodyError); } // Reject on body errors.

        const jschlAnswerIndex = response.body.indexOf("a = document.getElementById(\'jschl-answer\');");
        const jschlRedirectedIndex = response.body.indexOf("You are being redirected");
        const sucuriCloudproxyIndex = response.body.indexOf("sucuri_cloudproxy_js");

        if (jschlAnswerIndex >= 0) {
          return delay(4000) // wait 4000 ms to solve.
            .then(() => this.solveChallenge(response, options)) // Solve the JavaScript challenge.
            .then((answerOptions) => this.performRequest(answerOptions, onProgress)) // Submit the answer.
            .then((ckResponse) => {
              // Cleanup the qs from the options
              delete ckResponse.options.qs;
              // if method is a POST, we need to resubmit to get the correct response.
              if (ckResponse.options.method === "POST") {
                ckResponse.options.url = ckResponse.response.headers.location;
                return this.performRequest(ckResponse.options, onProgress);
              }
              // Not a post method, return the CloudKickerResponse
              return ckResponse;
            })
            .then(resolve) // Resolve the CloudKickerResponse
            .catch(reject); // Reject the error
        } else if (jschlRedirectedIndex >= 0 || sucuriCloudproxyIndex >= 0) {
          return this.setCookie(response, options) // This is a cookie challenge
            .then((cookieOptions) => this.performRequest(cookieOptions, onProgress)) // Rerun the request
            .then(resolve) // Resolve the CloudKickerResponse
            .catch(reject); // Reject the error
        } else { return resolve(new CloudKickerResponse(response, options)); }
      });

      // If onProgress is defined, call it.
      if (onProgress) {
        req.on("response", (response) => {
          if (response.statusCode === 503) {
            // Ignore events for 503
          } else {
            // Update totalBytes to Content-Length
            totalBytes = parseInt(response.headers["Content-Length"], 10);
            req.on("data", (data) => onProgress(receivedBytes += data.length, totalBytes, data));
          }
        });
      }
    });
  }

  // Solve the JS challenge from cloudflare
  private solveChallenge(
    response: request.RequestResponse,
    options: request.OptionsWithUrl): Promise<request.OptionsWithUrl> {
    return new Promise<request.Options>((resolve, reject) => {
      const body = response.body.toString();
      const host: string | undefined = response.request.host;
      if (!host) { return reject(new Error("Unable to get host from response.request")); }
      const protocol = (response.request as any).uri.protocol;
      const answerUrl = `${protocol}//${host}/cdn-cgi/l/chk_jschl`;

      const jschlVcRegex: RegExp = /name="jschl_vc" value="(\w+)"/;
      const passRegex: RegExp = /name="pass" value="(.+?)"/;
      const jschlVcMatch: RegExpMatchArray | null = body.match(jschlVcRegex);
      const passMatch: RegExpMatchArray | null = body.match(passRegex);

      if (!jschlVcMatch || !jschlVcMatch[1]) {
        return reject(new Error("Unable to parse jschl_vc from response."));
      } else if (!passMatch || !passMatch[1]) {
        return reject(new Error("Unable to parse pass from response."));
      }
      const jschlVc = jschlVcMatch[1];
      const pass = passMatch[1];
      const jschlAnswer = this.solveJschlAnswer(body, host);
      const answer = {
        jschl_answer: (jschlAnswer),
        jschl_vc: (jschlVc),
        pass: (pass),
      };
      const headers = _.extend(options.headers, {
        Referer: ((response.request as any).uri.href),
      });

      options = _.extend(options, {
        headers: (headers),
        qs: (answer),
        url: (answerUrl),
      });
      return resolve(options);
    });
  }

  // Set the cookie for cloudflare
  private setCookie(
    response: request.RequestResponse,
    options: request.OptionsWithUrl,
    timeout: number = 500): Promise<request.OptionsWithUrl> {
    return new Promise<request.Options>((resolve, reject) => {
      try {
        const body = response.body.toString();
        const encodedJsSrcRegex: RegExp = /S='([^']+)'/;
        const encodedJsSrcMatch: RegExpMatchArray | null = body.match(encodedJsSrcRegex);
        if (!encodedJsSrcMatch || !encodedJsSrcMatch[1]) {
          return reject(new Error("Unable to locate encoded cookie js source."));
        }
        const encodedJsSrc: string = encodedJsSrcMatch[1];
        const cookieJsSrc: string = new Buffer(encodedJsSrc, "base64").toString("ascii");
        // Run any foreign code in a vm sandbox
        const cookieSandbox: vm.Context = vm.createContext({
          document: {},
          location: { // The cookie code calls location.reload()
            reload: () => undefined, // Let's not and say we did...
          },
          window: {},
        });
        vm.runInContext(cookieJsSrc, cookieSandbox, {
          timeout: (timeout),
        });
        // Save the cookie
        const cookie: request.Cookie = (cookieSandbox as any).document.cookie;
        this.cookieJar.setCookie(cookie, (response.request as any).uri.href, {
          ignoreError: true,
        });
        return resolve(options);
      } catch (err) {
        return reject(err);
      }
    });
  }

  // Solve for the jschl answer
  private solveJschlAnswer(body: string, host: string, timeout: number = 50): number {
    const jschlRegex: RegExp = new RegExp([
      "getElementById\\('cf-content'\\)[\\s\\S]+?setTimeout.+?\\r?\\n([\\s\\S]+?a\\.",
      "value =.+?)\\r?\\n",
    ].join(""), "i");
    const jschlMatch: RegExpMatchArray | null = body.match(jschlRegex);
    if (!jschlMatch || !jschlMatch[1]) {
      throw new Error("Unable to find match in body for cf-content.");
    }
    const jschlSrc: string = jschlMatch[1] // Get the jschl src
      .replace(/a\.value =(.+?) \+ .+?;/i, "$1") // Remove content to detect host
      .replace(/\s{3,}[a-z](?: = |\.).+/g, "")
      .replace(/'; \d+'/g, "") // Strip bad data
      .replace("s,t,o,p,b,r,e,a,k,i,n,g,f, ", "")  // Strip the script of unused vars
      .replace("parseInt", "var jschl_answer=(parseInt") // Assign the result to a variable
      + `+ ${host.length});`; // Append host length to calculation
    // Run any foreign code in a vm sandbox
    const answerSandbox: vm.Context = vm.createContext();
    vm.runInContext(jschlSrc, answerSandbox, {
      timeout: (timeout),
    });
    return (answerSandbox as any).jschl_answer;
  }

  // Check the response body for any errors
  private checkForBodyErrors(body: any) {
    if (!body) {
      throw new Error("body is undefined");
    } else if (!_.isString(body)) {
      body = body.toString();
    }
    const cfCaptchaRegex: RegExp = /cdn-cgi\/l\/chk_captcha/i;
    const cfWhyCaptchaIndex: number = body.indexOf("why_captcha");
    if (cfWhyCaptchaIndex >= 0 || cfCaptchaRegex.test(body)) {
      throw new Error("Unable to handle Cloudflare Captcha.");
    }
    const cfErrorRegex: RegExp = /<\w+\s+class="cf-error-code">(.*)<\/\w+>/i;
    const cfErrorMatch: RegExpMatchArray = body.match(cfErrorRegex);
    if (cfErrorMatch) {
      throw new Error(`Cloudflare Error: ${cfErrorMatch[1]}`);
    }
  }

  // Translate request({method}) to request.method({})
  private request(options: request.Options, callback: request.RequestCallback): request.Request {
    const method = (options.method as string).toLowerCase();
    switch (method) {
      default: throw new Error("Unknown method was requested.");
      case "get": return request.get(options, callback);
      case "post": return request.post(options, callback);
      case "put": return request.put(options, callback);
      case "head": return request.head(options, callback);
      case "patch": return request.patch(options, callback);
      case "del": return request.del(options, callback);
      case "delete": return request.delete(options, callback);
    }
  }
}
export default CloudKicker;
