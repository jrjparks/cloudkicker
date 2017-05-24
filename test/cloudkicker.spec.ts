/// <reference types="mocha"/>
import { expect } from "chai";
import request = require("request");
import { CloudKicker } from "../src/index";

describe("CloudKicker Tests", () => {
  const cloudkicker = new CloudKicker();
  beforeEach(() => {
    cloudkicker.clearCookieJar();
  });

  it("get()");
  it("get(headers)");

  it("post()");
  it("post(headers)");

  it("performRequest()");
  it("performRequest(headers)");

  it("clearCookieJar()", () => {
    const url: string = "http://example.com";
    const testCookie: request.Cookie = request.cookie("test=test");
    expect(cloudkicker.cookieJar.getCookies(url)).to.be.empty;
    cloudkicker.cookieJar.setCookie(testCookie, url);
    expect(cloudkicker.cookieJar.getCookies(url)).to.have.length.of.at.most(1);
    cloudkicker.clearCookieJar();
    expect(cloudkicker.cookieJar.getCookies(url)).to.be.empty;
  });

  it("performRequest(onProgress)");
});
