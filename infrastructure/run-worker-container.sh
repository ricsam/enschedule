#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

docker container run \
  --rm \
  -e API_PORT=3000 \
  -e API_KEY=secret_key \
  -e ENSCHEDULE_API=true \
  -e PGUSER=postgres \
  -e PGHOST=postgres \
  -e PGPASSWORD=postgres \
  -e PGDATABASE=postgres \
  -e PGPORT=5432 \
  -e DEBUG='worker-api,pg-driver' \
  -p 3030:3000 \
  -i \
  -v ${PWD}/JobDefinitions:/app/packages/worker/definitions \
  --network enschedule-2_default \
  richi3/enschedule-worker:latest
