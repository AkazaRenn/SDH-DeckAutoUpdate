# we support images for building with a vanilla SteamOS base,
# or versions with ootb support for rust or go
# developers can also customize these images via this Dockerfile
#FROM ghcr.io/steamdeckhomebrew/holo-toolchain-rust:latest
#FROM ghcr.io/steamdeckhomebrew/holo-toolchain-go:latest
#FROM ghcr.io/steamdeckhomebrew/holo-base:latest

FROM ghcr.io/steamdeckhomebrew/builder:latest
ENTRYPOINT [ "/backend/pnpm_install.sh" ]

FROM docker.io/nikolaik/python-nodejs:latest
ENTRYPOINT [ "/backend/generate_protobuf.sh" ]