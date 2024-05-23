# Steam Deck Auto Update Plugin
A [decky-loader](https://github.com/SteamDeckHomebrew/deckly-loader) plugin for updaing the Steam client on a scheduled basis.

### Dependencies

This template relies on the user having `pnpm` installed on their system.
This can be downloaded from `npm` itself which is recommended.

#### Linux

```bash
sudo npm i -g pnpm
pnpm i
pnpm run build
```

#### Other important information

Everytime you change the frontend code (`index.tsx` etc) you will need to rebuild using the commands from step 2 above or the build task if you're using vscode or a derivative.

Note: If you are receiving build errors due to an out of date library, you should run this command inside of your repository:

```bash
pnpm update decky-frontend-lib --latest
```

# Credits
* https://github.com/0xD34D/FlatpakUpdater for providing a reference for me to start with this project
* https://github.com/Outpox/Bluetooth for how to use SteamClient APIs
* https://github.com/SteamDatabase/Protobufs for the Steam message protobuf definitions