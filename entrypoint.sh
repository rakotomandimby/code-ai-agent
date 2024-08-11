#!/bin/bash

export PATH="/node-v18.15.0-linux-x64/bin:/node_modules/.bin:"${PATH}
cd /code
#npx tsc
node dist/index.js
