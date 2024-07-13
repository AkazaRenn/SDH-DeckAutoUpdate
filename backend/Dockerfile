FROM docker.io/namely/protoc-all:latest

# <PLUGIN>/backend -> /backend
# <PLUGIN> -> /plugin
CMD ["-l", "node", "-d", "/backend/protobuf/source/steam", "-o", "/backend/protobuf/out", "--with-typescript"]
