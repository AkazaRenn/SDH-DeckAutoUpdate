#!/bin/sh
set -e

echo "Container's IP address: `awk 'END{print $1}' /etc/hosts`"
cd / && cd $(dirname $(find -name plugin.json 2> /dev/null | head -n1)) && pnpm install