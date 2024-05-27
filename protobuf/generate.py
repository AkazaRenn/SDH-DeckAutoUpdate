#!/usr/bin/env python3

from urllib.request import urlopen, urlretrieve
from subprocess import run, DEVNULL
import json
import tempfile
from pathlib import Path
from zipfile import ZipFile

protoc_release_url = "https://api.github.com/repos/protocolbuffers/protobuf/releases/latest"

protoc_download_dir = Path(tempfile.gettempdir()) / 'protoc'
protoc_path = protoc_download_dir / 'bin' / 'protoc'

repo_root = Path(__file__).parents[1]
output_dir = repo_root / 'protobuf/build'
proto_dir = repo_root / 'protobuf/Protobufs/steam'

protoc_ts_plugin = repo_root / 'node_modules/.bin/protoc-gen-ts'
protoc_js_plugin = repo_root / 'node_modules/.bin/protoc-gen-js'
protoc_commands = [
    f'{protoc_path} --plugin=protoc-gen-ts={protoc_ts_plugin} --ts_out=service=grpc-node:{output_dir} --proto_path={proto_dir} {proto_dir}/*.proto',
    f'{protoc_path} --plugin=protoc-gen-ts={protoc_js_plugin} --js_out=import_style=commonjs,binary:{output_dir} --proto_path={proto_dir} {proto_dir}/*.proto',
]

def main():
    if not protoc_path.exists():
        print(f'Did not find protoc at {protoc_path}, downloading...')
        download_protoc()

    # add exec permission
    protoc_path.chmod(0o755)

    if not output_dir.exists():
        output_dir.mkdir()
    elif not output_dir.is_dir():
        raise Exception(f'{output_dir} exists and is not a directory')
    for protoc_command in protoc_commands:
        print(f'Running command:\n\t{protoc_command}')
        run(protoc_command, shell=True, stderr=DEVNULL)

def download_protoc():
    data = json.loads(urlopen(protoc_release_url).read())
    for asset in data['assets']:
        if 'linux-x86_64' in asset['name']:
            protoc_archive_name = asset['name']
            protoc_link = asset['browser_download_url']
            break

    if not protoc_download_dir.exists():
        protoc_download_dir.mkdir()
    protoc_download_path = protoc_download_dir / protoc_archive_name
    urlretrieve(protoc_link, protoc_download_dir / protoc_download_path)
    print(f'Downloaded protoc to {protoc_download_path}, extracting to {protoc_download_dir}')

    with ZipFile(protoc_download_path, 'r') as zip_ref:
        zip_ref.extractall(protoc_download_dir)

if __name__ == '__main__':
    main()
