/// <reference types="mocha"/>
import { expect } from "chai";
import fs = require("fs");
import request = require("request");
import * as sinon from "sinon";
import { URL } from "url";
import { CloudKicker, delay, OnProgressCallback } from "../src/index";
import { CloudKickerOptions } from "../src/options";
const CI = process.env.CI;

describe("Function Tests", () => {
  [10, 20, 30, 50].forEach((ms) => {
    const allowedError: number = 5; // ms
    it(`should delay for ${ms}ms +/- ${allowedError}ms`, function() {
      this.timeout(ms * 2);
      this.slow(ms * 2);
      const start: Date = new Date();
      return delay(ms)
        .then(() => {
          const elapsed: number = Date.now() - start.getTime();
          expect(elapsed).to.be.within(ms - allowedError, ms + allowedError);
        });
    });
  });
});

describe("CloudKicker Tests", () => {

  const ckOptions: CloudKickerOptions = {
    timeout: 6000,
    userAgent: "Ubuntu Chromium/34.0.1847.116 Chrome/34.0.1847.116 Safari/537.36",
  };
  const cloudkicker = new CloudKicker(ckOptions);
  beforeEach(() => {
    cloudkicker.clearCookieJar();
  });

  it("should clear CookieJar", () => {
    const url: string = "http://example.com";
    const testCookie: request.Cookie = request.cookie("test=test");
    expect(cloudkicker.cookieJar.getCookies(url)).to.be.empty;
    cloudkicker.cookieJar.setCookie(testCookie, url);
    expect(cloudkicker.cookieJar.getCookies(url)).to.have.length.of.at.most(1);
    cloudkicker.clearCookieJar();
    expect(cloudkicker.cookieJar.getCookies(url)).to.be.empty;
  });

  describe("Local File Tests", function() {
    this.retries(3);
    const url: string = "http://localhost.test/index.html";
    const cfUrl: string = "http://localhost.test/cdn-cgi/l/chk_jschl";
    const getFixture = (path: string) => fs.readFileSync(`${__dirname}/fixtures/${path}`).toString();
    const indexHtml: string = getFixture("index.html");
    let sandbox: sinon.SinonSandbox;
    let clock: sinon.SinonFakeTimers;

    const generateFakeResponse = (code: number, body: any, requestUrl: string | URL) => {
      requestUrl = new URL(requestUrl as string);
      const headers: request.Headers = {
        "Content-Length": (body.length),
        "location": (requestUrl.toString()),
      };
      return {
        body: (body),
        headers: (headers),
        request: {
          host: (requestUrl.host),
          uri: (requestUrl),
          url: (requestUrl),
        },
        statusCode: (code),
      };
    };

    const cfAnswerArgs = (
      method: string,
      jschlAnswer: number,
      jschlVc: string,
      pass: string) => {
      const requestUrl: URL = new URL(cfUrl);
      return {
        method: (method),
        qs: {
          jschl_answer: jschlAnswer + requestUrl.host.length,
          jschl_vc: jschlVc,
          pass: (pass),
        },
        url: requestUrl.toString(),
      };
    };

    const fakeRequestObject = {
      on: (event: string, listener: any) => {
        switch (event) {
          default: break;
          case "response":
            listener(generateFakeResponse(200, indexHtml, url));
            break;
          case "data":
            listener("hello");
            break;
        }
      },
    };

    beforeEach("set-up", () => {
      cloudkicker.clearCookieJar();
      sandbox = sinon.sandbox.create();
      clock = sinon.useFakeTimers();
    });
    afterEach("tear-down", () => {
      sandbox.restore();
      clock.restore();
    });

    it("should fail with missing url", () => {
      const options = {
        method: "GET",
      };
      return cloudkicker.performRequest(options as request.OptionsWithUrl)
        .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
        .catch((error: Error) => {
          expect(error).to.be.ok;
          expect(error.message).to.be.equal("url is not defined");
        });
    });

    ["get", "post", "put", "head", "patch", "del", "delete"]
      .forEach((method: string) => {
        it(`should test method: ${method}`, () => {
          const requestOptions = {
            method: (method.toUpperCase()),
            url: (url),
          };
          const fakeResponse = generateFakeResponse(200, indexHtml, url);
          sandbox.stub(request, method).withArgs(sinon.match(requestOptions))
            .returns(fakeRequestObject).yields(null, fakeResponse);
          const p = cloudkicker.performRequest(requestOptions)
            .then(({options, response}) => {
              expect(options).to.be.ok;
              expect(response).to.be.ok;
              expect(response.body).to.be.ok;
              expect(response.body).to.contain("SUCCESS!");
            })
            .catch((error) => {
              throw error;
            });
          clock.tick(10000);
          return p;
        });
      });

    it("should fail unknown method", () => {
      const requestOptions = {
        method: "BAD",
        url: (url),
      };
      const p = cloudkicker.performRequest(requestOptions)
        .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
        .catch((error: Error) => {
          expect(error).to.be.ok;
          expect(error.message).to.be.equal("Unknown method was requested.");
        });
      clock.tick(10000);
      return p;
    });

    it("should get unprotected page", () => {
      const fakeResponse = generateFakeResponse(200, indexHtml, url);
      const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
      requestGet
        .withArgs(sinon.match({ method: "GET", url: (url) }))
        .returns(fakeRequestObject).yields(null, fakeResponse);

      const p = cloudkicker.get(url)
        .then(({options, response}) => {
          expect(options).to.be.ok;
          expect(response).to.be.ok;
          expect(response.body).to.be.ok;
          expect(response.body).to.contain("SUCCESS!");
        })
        .catch((error) => {
          throw error;
        });
      clock.tick(10000);
      return p;
    });

    [
      {jschl_vc: "08a298d4c2628034baf13a65447a39fa", jschl_answer: 503, pass: "1495346308.629-6l2sEPsMBE"},
      {jschl_vc: "b76be6a414be29304e71b8182e10f5ae", jschl_answer: 1932, pass: "1495346327.713-T7KiiSDaGn"},
      {jschl_vc: "fd3f772016f5128dd7c8a1c9aac25226", jschl_answer: -413, pass: "1495345360.223-WcJRFH1LVg"},
    ].forEach(({jschl_vc, jschl_answer, pass}) => {
      it(`should get protected page: jschl: ${jschl_vc}`, () => {
        const fakeResponse = generateFakeResponse(200, indexHtml, url);
        const cfRequestArgs = cfAnswerArgs("GET", jschl_answer, jschl_vc, pass);
        const cfResponse = generateFakeResponse(503, getFixture(`jschl/${jschl_vc}.html`), url);
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeRequestObject).yields(null, cfResponse);
        requestGet
          .withArgs(sinon.match(cfRequestArgs))
          .returns(fakeRequestObject).yields(null, fakeResponse);

        const p = cloudkicker.get(url)
          .then(({options, response}) => {
            expect(options).to.be.ok;
            expect(response).to.be.ok;
            expect(response.body).to.be.ok;
            expect(response.body).to.contain("SUCCESS!");
          })
          .catch((error) => {
            throw error;
          });
        clock.tick(10000);
        return p;
      });
    });
    });

  if (!CI) {
    describe("Live Tests", function() {
      this.timeout(6000); // there is a minimum of 4000ms on the live tests.
      this.slow(5000); // there is a minimum of 4000ms on the live tests.
      this.retries(3);

      before(function() { if (CI) { this.skip(); } });

      beforeEach(() => {
        cloudkicker.clearCookieJar();
      });

      it("should get unprotected page", () => {
        const url: string = "http://example.com/";
        return cloudkicker.get(url)
          .then(({options, response}) => {
            expect(options).to.be.ok;
            expect(options.method).to.be.equal("GET");

            expect(response).to.be.ok;
            expect(response.body).to.be.ok;
            expect(response.statusCode).to.be.equal(200);
            expect(/Example\sDomain/.test(response.body)).to.be.ok;
          })
          .catch((error) => {
            throw error;
          });
      });

      it("should get protected page", () => {
        const url: string = "http://kissmanga.com/Manga/Knights-Magic";
        return cloudkicker.get(url)
          .then(({options, response}) => {
            const cookies = cloudkicker.cookieJar.getCookies(url);
            expect(cookies).to.have.length.of.at.least(3);
            expect(options).to.be.ok;
            expect(options.method).to.be.equal("GET");

            expect(response).to.be.ok;
            expect(response.body).to.be.ok;
            expect(response.statusCode).to.be.equal(200);
            expect(/Knights\s&\sMagic/.test(response.body)).to.be.ok;
            expect(/\/Manga\/Knights-Magic/.test(response.body)).to.be.ok;
          })
          .catch((error) => {
            throw error;
          });
      });

      it("should post protected page", () => {
        const url: string = "http://kissmanga.com/Search/Manga";
        return cloudkicker.post(url, "keyword=One+Punch-Man")
          .then(({options, response}) => {
            const cookies = cloudkicker.cookieJar.getCookies(url);
            expect(cookies).to.have.length.of.at.least(3);
            expect(options).to.be.ok;
            expect(options.method).to.be.equal("POST");

            expect(response).to.be.ok;
            expect(response.body).to.be.ok;
            expect(response.statusCode).to.be.equal(200);
            expect(/Onepunch-Man/.test(response.body)).to.be.ok;
            expect(/Onepunch-Man\s\(ONE\)/.test(response.body)).to.be.ok;
          })
          .catch((error) => {
            throw error;
          });
      });

      it("performRequest(onProgress)", () => {
        const requestCfg: request.OptionsWithUrl = {
          encoding: "utf-8",
          method: "GET",
          url: "http://kissmanga.com/Manga/Knights-Magic",
        };
        const progress: OnProgressCallback = (c, t, data) => {
          expect(c).to.be.ok;
          expect(c).to.be.within(0, t || c + 1);
          expect(data).to.be.ok;
        };
        return cloudkicker.performRequest(requestCfg, progress)
          .then(({options, response}) => {
            const cookies = cloudkicker.cookieJar.getCookies(requestCfg.url);
            expect(cookies).to.have.length.of.at.least(3);
            expect(options).to.be.ok;
            expect(options.method).to.be.equal("GET");

            expect(response).to.be.ok;
            expect(response.body).to.be.ok;
            expect(response.statusCode).to.be.equal(200);
            expect(/Knights\s&\sMagic/.test(response.body)).to.be.ok;
            expect(/\/Manga\/Knights-Magic/.test(response.body)).to.be.ok;
          })
          .catch((error) => {
            throw error;
          });
      });
    });
  } else {
    describe("Skipping Live Tests, on CI", () => undefined);
  }
});
