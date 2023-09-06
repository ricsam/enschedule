#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

# Set git_root directory
git_root=$(git rev-parse --show-toplevel)

cd $git_root

docker build . --target worker --tag richi3/enschedule-worker:latest
docker build . --target dashboard --tag richi3/enschedule-dashboard:latest

echo "Docker image build completed!"
