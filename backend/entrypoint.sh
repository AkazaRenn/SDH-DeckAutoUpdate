#!/bin/sh
set -e

echo "Container's IP address: `awk 'END{print $1}' /etc/hosts`"
cd / && python3 $(find -name generate.py 2> /dev/null | head -n1)
