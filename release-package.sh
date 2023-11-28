#!/bin/bash
for pkg in worker-api types worker pg-driver; do
  jq '.main = "./dist/index.js" | .types = "./dist/index.d.ts"' ./packages/$pkg/package.json | sponge ./packages/$pkg/package.json
done
