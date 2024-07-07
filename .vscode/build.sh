#!/usr/bin/env bash
CLI_LOCATION="$(pwd)/cli"
echo "Building plugin in $(pwd)"
printf "Please input sudo password to proceed.\n"

# read -s sudopass

# printf "\n"

python3 $(pwd)/protobuf/generate.py
echo $sudopass | sudo $CLI_LOCATION/decky plugin build $(pwd)
