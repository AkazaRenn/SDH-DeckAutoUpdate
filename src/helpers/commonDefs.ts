import Plugin from "../json/plugin.json";
import { CMsgSystemUpdateState } from "../deps/protobuf/steammessages_client_objects_pb";
import { EUpdaterState } from "../deps/protobuf/enums_pb";

export const PLUGIN_NAME: string = Plugin.name;
export const PLUGIN_NAME_NO_SPACE: string = Plugin.name.replaceAll(' ', '');
export const PLUGIN_NAME_AS_PATH: string = Plugin.name.replaceAll(' ', '-').toLowerCase();

export const MOCK_OS_UPDATE_STATE: CMsgSystemUpdateState.AsObject = {
  state: EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING,
  supportsOsUpdates: true,
  updateCheckResultsList: [],
  updateApplyResultsList: [{
    requiresSystemRestart: true,
  }],
};

export enum UpdateResult {
  FAIL = -1,
  UPDATED = 0,
  NOT_UPDATED = 1,
}

export enum UpdateStatus {
  UP_TO_DATE,
  IN_PROGERSS,
  OS_RESTART_REQUIRED,
  CLIENT_RESTART_REQUIRED,
}
