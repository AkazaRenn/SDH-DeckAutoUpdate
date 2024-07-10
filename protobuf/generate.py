#!/usr/bin/env python3

from urllib.request import urlopen, urlretrieve
from subprocess import run, DEVNULL
from tempfile import gettempdir
import json
from pathlib import Path
from zipfile import ZipFile
from os import environ

protoc_release_url = "https://api.github.com/repos/protocolbuffers/protobuf/releases/latest"
file_path = Path(__file__).absolute()
file_dir = file_path.parent
repo_root = file_dir.parent

protoc_download_dir = Path(gettempdir()) / 'protoc'
protoc_path = protoc_download_dir / 'bin' / 'protoc'

output_dir = file_dir / 'build'
proto_dir = file_dir / 'source/steam'

node_modules_bin = repo_root / 'node_modules/.bin'
protoc_ts_plugin = node_modules_bin / 'protoc-gen-ts'
protoc_js_plugin = node_modules_bin / 'protoc-gen-js'
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
        output_dir.mkdir(exist_ok=True, parents=True)
    elif not output_dir.is_dir():
        raise Exception(f'{output_dir} exists and is not a directory')

    # protoc-gen-js refuses to run if it's not in $PATH
    env = environ.copy()
    env['PATH'] = f'{node_modules_bin}:{env["PATH"]}'
    for protoc_command in protoc_commands:
        print(f'Running command:\n\t{protoc_command}')
        run(protoc_command, shell=True, check=True, env=env, stderr=DEVNULL)

def download_protoc():
    data = json.loads(urlopen(protoc_release_url).read())
    for asset in data['assets']:
        if 'linux-x86_64' in asset['name']:
            protoc_archive_name = asset['name']
            protoc_link = asset['browser_download_url']
            break

    if not protoc_download_dir.exists():
        protoc_download_dir.mkdir(exist_ok=True, parents=True)
    protoc_download_path = protoc_download_dir / protoc_archive_name
    urlretrieve(protoc_link, protoc_download_dir / protoc_download_path)
    print(f'Downloaded protoc to {protoc_download_path}, extracting to {protoc_download_dir}')

    with ZipFile(protoc_download_path, 'r') as zip_ref:
        zip_ref.extractall(protoc_download_dir)

if __name__ == '__main__':
    main()
