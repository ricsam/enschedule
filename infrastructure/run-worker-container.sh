#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

docker container run \
  --rm \
  -e ENSCHEDULE_API_PORT=3000 \
  -e ENSCHEDULE_API_KEY=secret_key \
  -e ENSCHEDULE_API=true \
  -e POSTGRES=true \
  -e DB_USER=postgres \
  -e DB_HOST=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_DATABASE=postgres \
  -e DB_PORT=5432 \
  -e DEBUG='worker-api,pg-driver' \
  -p 3030:3000 \
  -i \
  -v ${PWD}/charts/enschedule/files:/app/packages/worker/definitions \
  --network enschedule-2_default \
  ghcr.io/ricsam/enschedule-worker:latest
