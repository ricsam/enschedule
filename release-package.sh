#!/bin/bash

set -eo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR

for pkg in worker-api types worker pg-driver hub; do
  jq '.main = "./dist/index.js" | .types = "./dist/index.d.ts"' ./packages/$pkg/package.json | sponge ./packages/$pkg/package.json
done
