#!/usr/bin/env bash

set -eo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR

multipass stop ci || true
multipass delete ci || true
multipass purge

sudo route -nv delete -net 192.168.64.0/24 || true
