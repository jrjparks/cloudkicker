# CloudKicker

## Status
[![npm](https://img.shields.io/npm/v/cloudkicker.svg?style=flat-square)](https://www.npmjs.com/package/cloudkicker) [![Dependencies](https://img.shields.io/david/jrjparks/cloudkicker.svg?style=flat-square)](https://david-dm.org/jrjparks/cloudkicker) [![devDependencies](https://img.shields.io/david/dev/jrjparks/cloudkicker.svg?style=flat-square)](https://david-dm.org/jrjparks/cloudkicker?type=dev)

| Branch | Master | Development |
| - | -: | -: |
| Travis-CI | [![Travis branch](https://img.shields.io/travis/jrjparks/cloudkicker/master.svg?style=flat-square)](https://travis-ci.org/jrjparks/cloudkicker) | [![Travis branch](https://img.shields.io/travis/jrjparks/cloudkicker/development.svg?style=flat-square)](https://travis-ci.org/jrjparks/cloudkicker) |
| Coveralls | [![Coveralls branch](https://img.shields.io/coveralls/jrjparks/cloudkicker/master.svg?style=flat-square)](https://coveralls.io/github/jrjparks/cloudkicker?branch=master) | [![Coveralls branch](https://img.shields.io/coveralls/jrjparks/cloudkicker/development.svg?style=flat-square)](https://coveralls.io/github/jrjparks/cloudkicker?branch=development) |

## About
Typescript Cloudflare bypass with promises.

###### Example
```bash
$ npm install -save cloudkicker
```

```javascript
// Javascript
var cloudkicker = require('cloudkicker');
var ck = new cloudkicker.CloudKicker();
ck.get('https://example.com/')
    .then(function(cloudkicker_response) {
        // Do something with
        // cloudkicker_response.options,
        // cloudkicker_response.response  <-  This is what you'll normally need.
    }).catch(function (error) {
        // Do something with error
    });
```

```typescript
// Typescript
import { CloudKicker } from "cloudkicker";
const cloudkicker = new CloudKicker();
cloudkicker.get("https://example.com/")
    .then(({response}) => {
        // Do something with response.
    }).catch((error) => {
        // Do something with error
    });
```
