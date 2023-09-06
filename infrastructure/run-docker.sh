#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

docker container run -e PORT=3000 -p 3030:3000 richi3/enschedule-worker:latest


# richi3/enschedule-dashboard:latest
