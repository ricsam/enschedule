#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

# Set git_root directory
git_root=$(git rev-parse --show-toplevel)

cd $git_root

docker image push ghcr.io/ricsam/enschedule-worker:latest
docker image push ghcr.io/ricsam/enschedule-dashboard:latest

echo "Docker images pushed!"
