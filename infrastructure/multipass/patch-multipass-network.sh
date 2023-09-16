#!/bin/bash
set -eo pipefail

sudo route -nv delete -net 192.168.64.0/24 || true
sudo route -nv add -net 192.168.64.0/24 -interface bridge100
