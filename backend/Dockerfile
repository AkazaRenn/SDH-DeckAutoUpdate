# we support images for building with a vanilla SteamOS base,
# or versions with ootb support for rust or go
# developers can also customize these images via this Dockerfile
#FROM ghcr.io/steamdeckhomebrew/holo-toolchain-rust:latest
#FROM ghcr.io/steamdeckhomebrew/holo-toolchain-go:latest
#FROM ghcr.io/steamdeckhomebrew/holo-base:latest

FROM docker.io/nikolaik/python-nodejs:latest

RUN npm install -g pnpm@8.5.1

ENTRYPOINT [ "/backend/entrypoint.sh" ]