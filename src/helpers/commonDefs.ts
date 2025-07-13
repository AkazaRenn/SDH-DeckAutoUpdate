import Plugin from "../json/plugin.json";

export const PLUGIN_NAME: string = Plugin.name;
export const PLUGIN_NAME_NO_SPACE: string = Plugin.name.replaceAll(' ', '');
export const PLUGIN_NAME_AS_PATH: string = Plugin.name.replaceAll(' ', '-').toLowerCase();

export enum UpdateResult {
  FAIL = -1,
  UPDATED = 0,
  NOT_UPDATED = 1,
}

export enum UpdateStatus {
  UP_TO_DATE,
  OS_RESTART_REQUIRED,
  CLIENT_RESTART_REQUIRED,
}
