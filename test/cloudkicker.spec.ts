/// <reference types="mocha"/>
import { expect } from "chai";
import request = require("request");
import { CloudKicker, delay, OnProgressCallback } from "../src/index";
import { CloudKickerOptions } from "../src/options";

describe("Function Tests", () => {
  [10, 20, 30, 50].forEach((ms) => {
    const allowedError: number = 5; // ms
    it(`delay(${ms}) is +/- ${allowedError}ms`, function() {
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

  it("clearCookieJar()", () => {
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
    beforeEach(() => {
      cloudkicker.clearCookieJar();
    });

    it("get()");
    it("get(headers)");

    it("post()");
    it("post(headers)");

    it("performRequest()");
    it("performRequest(headers)");

    it("performRequest(onProgress)");
  });

  describe("Live Tests", function() {
    this.timeout(6000); // there is a minimum of 4000ms on the live tests.
    this.slow(5000); // there is a minimum of 4000ms on the live tests.
    this.retries(3);

    beforeEach(() => {
      cloudkicker.clearCookieJar();
    });

    it("get()", () => {
      const url: string = "http://kissmanga.com/Manga/Knights-Magic";
      return cloudkicker.get(url)
        .then(({options, response}) => {
          expect(cloudkicker.cookieJar.getCookies(url)).to.have.length.of.at.least(3);
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
    it("get(headers)");

    it("post()", () => {
      const url: string = "http://kissmanga.com/Search/Manga";
      return cloudkicker.post(url, "keyword=One+Punch-Man")
        .then(({options, response}) => {
          expect(cloudkicker.cookieJar.getCookies(url)).to.have.length.of.at.least(3);
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
    it("post(headers)");

    it("performRequest()");
    it("performRequest(headers)");

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
          console.log(`cookies for '${requestCfg.url}': ${JSON.stringify(cookies)}`);
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
});
