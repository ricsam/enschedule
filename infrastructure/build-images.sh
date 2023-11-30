#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

# Set git_root directory
git_root=$(git rev-parse --show-toplevel)

cd $git_root

push_flag=""
if [ "$1" == "--push" ]; then
  push_flag="--push"
fi

docker build . --target worker --tag ghcr.io/ricsam/enschedule-worker:latest $push_flag
docker build . --target dashboard --tag ghcr.io/ricsam/enschedule-dashboard:latest $push_flag

echo "Docker image build completed!"
