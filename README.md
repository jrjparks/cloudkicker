# CloudKicker

## Status
[![npm](https://img.shields.io/npm/v/cloudkicker.svg?style=flat-square)](https://www.npmjs.com/package/cloudkicker) [![Dependencies](https://img.shields.io/david/jrjparks/cloudkicker.svg?style=flat-square)](https://david-dm.org/jrjparks/cloudkicker) [![devDependencies](https://img.shields.io/david/dev/jrjparks/cloudkicker.svg?style=flat-square)](https://david-dm.org/jrjparks/cloudkicker?type=dev)

| Branch | Master | Development |
| - | -: | -: |
| Travis-CI | [![Travis branch](https://img.shields.io/travis/jrjparks/cloudkicker/master.svg?style=flat-square)](https://travis-ci.org/jrjparks/cloudkicker) | [![Travis branch](https://img.shields.io/travis/jrjparks/cloudkicker/development.svg?style=flat-square)](https://travis-ci.org/jrjparks/cloudkicker) |
| Coveralls | [![Coveralls branch](https://img.shields.io/coveralls/jrjparks/cloudkicker/master.svg?style=flat-square)](https://coveralls.io/github/jrjparks/cloudkicker?branch=master) | [![Coveralls branch](https://img.shields.io/coveralls/jrjparks/cloudkicker/development.svg?style=flat-square)](https://coveralls.io/github/jrjparks/cloudkicker?branch=development) |

## About
Typescript Cloudflare bypass with promises.

## Examples
```javascript
/* Basic Example */
import { CloudKicker } from "cloudkicker";
const cloudkicker = new CloudKicker();
cloudkicker.get("https://example.com/").then(({options, response}) => {
  /* response.body is a Buffer */
  const body: string = response.body.toString();
  /* Do some cool stuff with the response */
}).catch((error) => {
  console.error(error);
});
```

```javascript
/* Pipe Example */
import { CloudKicker } from "cloudkicker";
import * as request from "request";
import * as fs from "fs";
const cloudkicker = new CloudKicker();
const index = await cloudkicker.get("https://example.com/");
const options: request.Options = {
  encoding: "utf-8",
  jar: cloudkicker.cookieJar,
  method: "GET",
  url: "https://example.com/doodle.png",
};
request(options).pipe(fs.createWriteStream("doodle.png"));
```
