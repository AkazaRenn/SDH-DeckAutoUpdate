import { beforePatch } from "@decky/ui";
import Logger from "./logger";
import Registeration from "../types/registration";

import { CMsgSystemUpdateState } from "../deps/protobuf/steammessages_client_objects_pb";
import { EUpdaterState } from "../deps/protobuf/enums_pb";

class UpdateManager extends Registeration {
  protected _register(): UnregisterFunction {
    const updateStateChangeRegistration = SteamClient.Updates.RegisterForUpdateStateChanges(this.updateStateChangeHandler) as Unregisterable;
    const applyUpdatesPatch = beforePatch(SteamClient.Updates, "ApplyUpdates", (inputs: any[]) => {
      Logger.info("ApplyUpdates", ...inputs);
      try {
        const decodedString = atob(inputs[0] as string);
        const deserializedData = JSON.parse(decodedString);
        Logger.info("Decoded input:", decodedString, deserializedData);
      } catch (e) {
        Logger.error("Failed to parse input:", e);
      }
    });

    return () => {
      updateStateChangeRegistration.unregister();
      applyUpdatesPatch.unpatch();
    }
  }

  private updateStateChangeHandler = (protoMsg: Uint8Array): void => {
    try {
      var updateState = CMsgSystemUpdateState.deserializeBinary(protoMsg).toObject();
    } catch (e) {
      Logger.error("Failed to parse update state: " + e);
      return;
    }

    switch (updateState.state) {
      case EUpdaterState.K_EUPDATERSTATE_INVALID:
        Logger.info("updateState.state K_EUPDATERSTATE_INVALID");
        break;
      case EUpdaterState.K_EUPDATERSTATE_UPTODATE:
        Logger.info("updateState.state K_EUPDATERSTATE_UPTODATE");
        break;
      case EUpdaterState.K_EUPDATERSTATE_CHECKING:
        Logger.info("updateState.state K_EUPDATERSTATE_CHECKING");
        break;
      case EUpdaterState.K_EUPDATERSTATE_AVAILABLE:
        Logger.info("updateState.state K_EUPDATERSTATE_AVAILABLE");
        break;
      case EUpdaterState.K_EUPDATERSTATE_APPLYING:
        Logger.info("updateState.state K_EUPDATERSTATE_APPLYING");
        break;
      case EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING:
        Logger.info("updateState.state K_EUPDATERSTATE_CLIENTRESTARTPENDING");
        break;
      case EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING:
        Logger.info("updateState.state K_EUPDATERSTATE_SYSTEMRESTARTPENDING");
        break;
      case EUpdaterState.K_EUPDATERSTATE_ROLLBACK:
        Logger.info("updateState.state K_EUPDATERSTATE_ROLLBACK");
        break;
      default:
        Logger.info("updateState.state UNRECOGNIZED", updateState.state);
        break;
    }
  }
}

const updateManager = new UpdateManager();
export default updateManager;
