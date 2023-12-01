#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

# Set git_root directory
git_root=$(git rev-parse --show-toplevel)

cd $git_root

push_flag=""
if [ "$2" == "--push" ]; then
  push_flag="--push"
fi
tag="alpha"
if [ -n "$1" ]; then
  tag=$1
fi

docker build . --target worker --tag ghcr.io/ricsam/enschedule-worker:$tag $push_flag
docker build . --target dashboard --tag ghcr.io/ricsam/enschedule-dashboard:$tag $push_flag

echo "Docker image build completed!"
