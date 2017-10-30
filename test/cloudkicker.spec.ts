/// <reference types="mocha"/>
import { expect } from "chai";
import fs = require("fs");
import request = require("request");
import * as sinon from "sinon";
import { Url, URL } from "url";
import { delay } from "../src/cloudkicker";
import { CloudKicker, OnProgressCallback } from "../src/index";
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
  const cloudkicker = new CloudKicker();
  beforeEach("set-up", () => {
    cloudkicker.clearCookieJar();
  });

  it("should clear CookieJar", () => {
    const url: string = "http://example.com";
    const testCookie: request.Cookie = request.cookie("test=test");
    expect(cloudkicker.cookieJar.getCookies(url)).to.be.empty;
    cloudkicker.cookieJar.setCookie(testCookie, url);
    expect(cloudkicker.cookieJar.getCookies(url)).to.have.lengthOf(1);
    cloudkicker.clearCookieJar();
    expect(cloudkicker.cookieJar.getCookies(url)).to.be.empty;
  });

  it("should test CloudKickerOptions", () => {
    const options: CloudKickerOptions = new CloudKickerOptions("Test User-Agent");
    expect(options.userAgent).to.be.equal("Test User-Agent");
  });

  describe("Local File Tests", () => {
    const url: string = "http://localhost.test/index.html";
    const cfUrl: string = "http://localhost.test/cdn-cgi/l/chk_jschl";
    const getFixtureBuffer = (path: string) => fs.readFileSync(`${__dirname}/fixtures/${path}`);
    const getFixture = (path: string) => getFixtureBuffer(path).toString();
    const indexHtmlBuffer: Buffer = getFixtureBuffer("index.html");
    const indexHtml: string = indexHtmlBuffer.toString();
    // const index2Html: string = getFixture("index2.html");
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

    const fakeCfRequestObject = {
      on: (event: string, listener: any) => {
        switch (event) {
          default: break;
          case "response":
            listener(generateFakeResponse(503, indexHtml, url));
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
      .forEach((method: any) => {
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
              expect(options.method).to.be.equal(method.toUpperCase());
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

    it("should test onProgress", () => {
      const requestOptions: request.OptionsWithUrl = {
        encoding: "utf-8",
        method: "GET",
        url: (url),
      };
      const progress: OnProgressCallback = (c, t, data) => {
        expect(c).to.be.ok;
        expect(c).to.be.within(0, t || c + 1);
        expect(data).to.be.ok;
      };
      const fakeResponse = generateFakeResponse(200, indexHtml, url);
      sandbox.stub(request, "get").withArgs(sinon.match(requestOptions))
        .returns(fakeRequestObject).yields(null, fakeResponse);
      const p = cloudkicker.performRequest(requestOptions, progress)
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

    it("should test performRequest raw response with onProgress", () => {
      const requestOptions: request.OptionsWithUrl = {
        encoding: "utf-8",
        method: "GET",
        url: (url),
      };
      const progress: OnProgressCallback = (c, t, data) => {
        expect(c).to.be.ok;
        expect(c).to.be.within(0, t || c + 1);
        expect(data).to.be.ok;
      };
      const fakeResponse = generateFakeResponse(200, indexHtmlBuffer, url);
      sandbox.stub(request, "get").withArgs(sinon.match(requestOptions))
        .returns(fakeRequestObject).yields(null, fakeResponse);
      const p = cloudkicker.performRequest(requestOptions, progress)
        .then(({options, response}) => {
          expect(options).to.be.ok;
          expect(response).to.be.ok;
          expect(response.body).to.be.ok;
          expect(response.body).to.have.lengthOf(indexHtmlBuffer.length);
        })
        .catch((error) => {
          throw error;
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
          expect(/<title>CloudKicker\sIndex<\/title>/.test(response.body)).to.ok;
        })
        .catch((error) => {
          throw error;
        });
      clock.tick(10000);
      return p;
    });

    describe("Jschl Answer", () => {

      it("should test performRequest with onProgress on protected page", () => {
        const jschlVc: string = "08a298d4c2628034baf13a65447a39fa";
        const jschlAnswer: number =  503;
        const pass: string = "1495346308.629-6l2sEPsMBE";
        const requestOptions: request.OptionsWithUrl = {
          encoding: "utf-8",
          method: "GET",
          url: (url),
        };
        const progress: OnProgressCallback = (c, t, data) => {
          expect(c).to.be.ok;
          expect(c).to.be.within(0, t || c + 1);
          expect(data).to.be.ok;
        };
        const fakeResponse = generateFakeResponse(200, indexHtmlBuffer, url);
        const cfRequestArgs = cfAnswerArgs("GET", jschlAnswer, jschlVc, pass);
        const cfResponse = generateFakeResponse(503, getFixture(`jschlAnswer/${jschlVc}.html`), url);
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeCfRequestObject).yields(null, cfResponse);
        requestGet
          .withArgs(sinon.match(cfRequestArgs))
          .returns(fakeRequestObject).yields(null, fakeResponse);

        const p = cloudkicker.performRequest(requestOptions, progress)
          .then(({options, response}) => {
            expect(options).to.be.ok;
            expect(response).to.be.ok;
            expect(response.body).to.be.ok;
            expect(response.body).to.have.lengthOf(indexHtmlBuffer.length);
          })
          .catch((error) => {
            throw error;
          });
        clock.tick(10000);
        return p;
      });

      [
        { jschl_vc: "08a298d4c2628034baf13a65447a39fa", jschl_answer: 503, pass: "1495346308.629-6l2sEPsMBE" },
        { jschl_vc: "b76be6a414be29304e71b8182e10f5ae", jschl_answer: 1932, pass: "1495346327.713-T7KiiSDaGn" },
        { jschl_vc: "fd3f772016f5128dd7c8a1c9aac25226", jschl_answer: -413, pass: "1495345360.223-WcJRFH1LVg" },
      ].forEach(({jschl_vc, jschl_answer, pass}) => {
        it(`should get page protected by jschlAnswer: ${jschl_vc}`, () => {
          const fakeResponse = generateFakeResponse(200, indexHtml, url);
          const cfRequestArgs = cfAnswerArgs("GET", jschl_answer, jschl_vc, pass);
          const cfResponse = generateFakeResponse(503, getFixture(`jschlAnswer/${jschl_vc}.html`), url);
          const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
          requestGet
            .withArgs(sinon.match({ method: "GET", url: (url) }))
            .returns(fakeCfRequestObject).yields(null, cfResponse);
          requestGet
            .withArgs(sinon.match(cfRequestArgs))
            .returns(fakeRequestObject).yields(null, fakeResponse);

          const p = cloudkicker.get(url)
            .then(({options, response}) => {
              expect(options).to.be.ok;
              expect(response).to.be.ok;
              expect(response.body).to.be.ok;
              expect(/<title>CloudKicker\sIndex<\/title>/.test(response.body)).to.ok;
            })
            .catch((error) => {
              throw error;
            });
          clock.tick(10000);
          return p;
        });
      });

      [
        { jschl_vc: "08a298d4c2628034baf13a65447a39fa", jschl_answer: 503, pass: "1495346308.629-6l2sEPsMBE" },
        { jschl_vc: "b76be6a414be29304e71b8182e10f5ae", jschl_answer: 1932, pass: "1495346327.713-T7KiiSDaGn" },
        { jschl_vc: "fd3f772016f5128dd7c8a1c9aac25226", jschl_answer: -413, pass: "1495345360.223-WcJRFH1LVg" },
      ].forEach(({jschl_vc, jschl_answer, pass}) => {
        it(`should post page protected by jschlAnswer: ${jschl_vc}`, () => {
          const fakeResponse = generateFakeResponse(200, indexHtml, url);
          const fakeRedirect = generateFakeResponse(302, "Redirect 302", url);
          const cfRequestArgs = cfAnswerArgs("POST", jschl_answer, jschl_vc, pass);
          const cfResponse = generateFakeResponse(503, getFixture(`jschlAnswer/${jschl_vc}.html`), url);
          const requestPost: sinon.SinonStub = sandbox.stub(request, "post");
          requestPost
            .withArgs(sinon.match({ method: "POST", url: (url) }))
            .onCall(0).returns(fakeCfRequestObject)
            .onCall(1).returns(fakeRequestObject)
            .onCall(0).yields(null, cfResponse)
            .onCall(1).yields(null, fakeResponse);
          requestPost
            .withArgs(sinon.match(cfRequestArgs))
            .returns(fakeRequestObject).yields(null, fakeRedirect);

          const p = cloudkicker.post(url, pass)
            .then(({options, response}) => {
              expect(options).to.be.ok;
              expect(response).to.be.ok;
              expect(response.body).to.be.ok;
              expect(/<title>CloudKicker\sIndex<\/title>/.test(response.body)).to.ok;
            })
            .catch((error) => {
              throw error;
            });
          clock.tick(10000);
          return p;
        });
      });
    });

    describe("Jschl Cookie", () => {
      [
        { key: "sucuri_cloudproxy_uuid_575ef0f62", value: "16cc0aa4400d9c6961cce3ce380ce11a" },
        { key: "sucuri_cloudproxy_uuid_f6bada708", value: "443a49eff7da89ff815e57b724e66eaf" },
      ].forEach(({key, value}) => {
        it(`should get page protected by jschlCookie: ${key}`, () => {
          const expectedCookie = `${key}=${value}`;
          const fakeResponse = generateFakeResponse(200, indexHtml, url);
          const cfResponse = generateFakeResponse(503, getFixture(`jschlCookie/${value}.html`), url);
          const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
          requestGet.withArgs(sinon.match({ method: "GET", url: (url) }))
            .onCall(0).returns(fakeCfRequestObject)
            .onCall(1).returns(fakeRequestObject)
            .onCall(0).yields(null, cfResponse)
            .onCall(1).yields(null, fakeResponse);

          const p = cloudkicker.get(url)
            .then(({options, response}) => {
              expect(options).to.be.ok;
              expect(response).to.be.ok;
              expect(response.body).to.be.ok;
              expect(cloudkicker.cookieJar.getCookieString(url)).to.be.include(expectedCookie);
              expect(/<title>CloudKicker\sIndex<\/title>/.test(response.body)).to.ok;
            })
            .catch((error) => {
              throw error;
            });
          clock.tick(10000);
          return p;
        });
      });
    });

    describe("Test Errors", () => {

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

      it("should fail on error", () => {
        const fakeResponse = generateFakeResponse(404, indexHtml, url);
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeRequestObject).yields(new Error("ETIMEDOUT"), fakeResponse);
        const p = cloudkicker.get(url)
          .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
          .catch((error: Error) => {
            expect(error).to.be.ok;
            expect(error.message).to.be.equal("ETIMEDOUT");
          });
        clock.tick(10000);
        return p;
      });

      it("should fail with missing host in response", () => {
        const jschlVc: string = "08a298d4c2628034baf13a65447a39fa";
        const cfResponse = generateFakeResponse(503, getFixture(`jschlAnswer/${jschlVc}.html`), url);
        delete cfResponse.request.host;
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeCfRequestObject).yields(null, cfResponse);
        const p = cloudkicker.get(url)
          .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
          .catch((error: Error) => {
            expect(error).to.be.ok;
            expect(error.message).to.be.equal("Unable to get host from response.request");
          });
        clock.tick(10000);
        return p;
      });

      ["jschl_vc", "pass"].forEach((variable) => {
        it(`should fail with missing ${variable} in response`, () => {
          const jschlVc: string = "08a298d4c2628034baf13a65447a39fa";
          const content: string = getFixture(`jschlAnswer/${jschlVc}.html`)
            .replace(new RegExp(variable, "g"), `${variable}_bad`);
          const cfResponse = generateFakeResponse(503, content, url);
          const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
          requestGet
            .withArgs(sinon.match({ method: "GET", url: (url) }))
            .returns(fakeCfRequestObject).yields(null, cfResponse);
          const p = cloudkicker.get(url)
            .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
            .catch((error: Error) => {
              expect(error).to.be.ok;
              expect(error.message).to.be.equal(`Unable to parse ${variable} from response.`);
            });
          clock.tick(10000);
          return p;
        });
      });

      it(`should fail with missing cf-content in response`, () => {
        const jschlVc: string = "08a298d4c2628034baf13a65447a39fa";
        const content: string = getFixture(`jschlAnswer/${jschlVc}.html`)
          .replace(/cf-content/g, "cf-content_bad");
        const cfResponse = generateFakeResponse(503, content, url);
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeCfRequestObject).yields(null, cfResponse);
        const p = cloudkicker.get(url)
          .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
          .catch((error: Error) => {
            expect(error).to.be.ok;
            expect(error.message).to.be.equal("Unable to find match in body for cf-content.");
          });
        clock.tick(10000);
        return p;
      });

      it("should fail with missing embedded cookie in response", () => {
        const cookie: string = "16cc0aa4400d9c6961cce3ce380ce11a";
        const content: string = getFixture(`jschlCookie/${cookie}.html`)
          .replace(/S='/g, "BAD='");
        const cfResponse = generateFakeResponse(503, content, url);
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeCfRequestObject).yields(null, cfResponse);
        const p = cloudkicker.get(url)
          .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
          .catch((error: Error) => {
            expect(error).to.be.ok;
            expect(error.message).to.be.equal("Unable to locate encoded cookie js source.");
          });
        clock.tick(10000);
        return p;
      });

      it("should fail with bad embedded cookie code in response", () => {
        const content: string = getFixture(`errors/embedded_cookie.html`);
        const cfResponse = generateFakeResponse(503, content, url);
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeCfRequestObject).yields(null, cfResponse);
        const p = cloudkicker.get(url)
          .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
          .catch((error: Error) => {
            expect(error).to.be.ok;
            expect(error.message).to.be.equal("alert is not defined");
          });
        clock.tick(10000);
        return p;
      });

      it("should fail on captcha page", () => {
        const captcha: string = "6LeT6gcAAAAAAAZ_yDmTMqPH57dJQZdQcu6VFqog";
        const cfResponse = generateFakeResponse(503, getFixture(`captcha/${captcha}.html`), url);
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeCfRequestObject).yields(null, cfResponse);
        const p = cloudkicker.get(url)
          .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
          .catch((error: Error) => {
            expect(error).to.be.ok;
            expect(error.message).to.be.equal("Unable to handle Cloudflare Captcha.");
          });
        clock.tick(10000);
        return p;
      });

      it("should fail on error page", () => {
        const errorCode: string = "1006";
        const cfResponse = generateFakeResponse(503, getFixture(`errors/${errorCode}.html`), url);
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeCfRequestObject).yields(null, cfResponse);
        const p = cloudkicker.get(url)
          .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
          .catch((error: Error) => {
            expect(error).to.be.ok;
            expect(error.message).to.be.equal(`Cloudflare Error: ${errorCode}`);
          });
        clock.tick(10000);
        return p;
      });

      it("should fail on undefined body", () => {
        const cfResponse = generateFakeResponse(503, indexHtml, url);
        cfResponse.body = undefined;
        const requestGet: sinon.SinonStub = sandbox.stub(request, "get");
        requestGet
          .withArgs(sinon.match({ method: "GET", url: (url) }))
          .returns(fakeCfRequestObject).yields(null, cfResponse);
        const p = cloudkicker.get(url)
          .then((result) => { throw new Error(`Promise was unexpectedly fulfilled. Result: ${result}`); })
          .catch((error: Error) => {
            expect(error).to.be.ok;
            expect(error.message).to.be.equal("body is undefined");
          });
        clock.tick(10000);
        return p;
      });

    });

  });

  describe("Remote Live Tests", function() {
    if (CI) {
      it.skip("detected running on CI, skipping");
    } else {
      this.timeout(6000); // there is a minimum of 4000ms on the live tests.
      this.slow(5000); // there is a minimum of 4000ms on the live tests.
      this.retries(3);

      beforeEach(() => {
        cloudkicker.clearCookieJar();
      });

      it("should get unprotected page 'http://example.com/'", () => {
        const url: Url | string = new URL("http://example.com/");
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

      it("should get protected page 'http://kissmanga.com/Manga/Knights-Magic'", () => {
        const url: Url | string = new URL("http://kissmanga.com/Manga/Knights-Magic");
        return cloudkicker.get(url)
          .then(({options, response}) => {
            const cookies = cloudkicker.cookieJar.getCookies(url);
            expect(cookies).to.have.lengthOf(3);
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

      it("should post protected page 'http://kissmanga.com/Search/Manga'", () => {
        const url: Url | string = new URL("http://kissmanga.com/Search/Manga");
        return cloudkicker.post(url, "keyword=One+Punch-Man")
          .then(({options, response}) => {
            const cookies = cloudkicker.cookieJar.getCookies(url);
            expect(cookies).to.have.lengthOf(3);
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

      it("should get protected page 'http://kissmanga.com/Manga/Knights-Magic' with progress", () => {
        const requestCfg: request.OptionsWithUrl = {
          encoding: "utf-8",
          method: "GET",
          url: new URL("http://kissmanga.com/Manga/Knights-Magic"),
        };
        const progress: OnProgressCallback = (c, t, data) => {
          expect(c).to.be.ok;
          expect(c).to.be.within(0, t || c + 1);
          expect(data).to.be.ok;
        };
        return cloudkicker.performRequest(requestCfg, progress)
          .then(({options, response}) => {
            const cookies = cloudkicker.cookieJar.getCookies(requestCfg.url);
            expect(cookies).to.have.lengthOf(3);
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
    }
  });
});
