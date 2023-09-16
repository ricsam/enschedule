#!/usr/bin/env bash

set -eo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR


cpu="8"
disk_size="8G"
memory="8G"

multipass -vvv launch 22.04 --disk $disk_size --cpus $cpu --memory $memory --name ci
