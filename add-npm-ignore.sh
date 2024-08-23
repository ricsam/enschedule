#!/bin/bash

set -eo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR

for pkg in handlers/fetch-handler handlers/log-handler packages/types packages/pg-driver packages/worker-api packages/worker packages/hub; do
  cat <<EOF > ./$pkg/.npmignore
.env
.npmignore
.turbo
jest.config.js
.eslintrc.js
tsconfig.json
__snapshots__
jest.env.js
docker
Dockerfile
__fixtures__
EOF


done
