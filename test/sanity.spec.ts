/// <reference types="mocha"/>
import { expect } from "chai";

describe("Sanity Tests", () => {
  it("true should be ok", () => {
    expect(true).to.be.ok;
  });

  it("true should be true", () => {
    expect(true).to.be.equal(true);
  });

  it("false should not be ok", () => {
    expect(false).to.not.be.ok;
  });

  it("true should not be false", () => {
    expect(true).to.not.be.equal(false);
  });

  it("0 should be less than 1", () => {
    expect(0).to.be.lessThan(1);
  });

  it("empty array should be empty", () => {
    expect([]).to.be.empty;
  });

  it("filled array should not be empty", () => {
    expect([1]).to.be.not.empty;
  });
});
