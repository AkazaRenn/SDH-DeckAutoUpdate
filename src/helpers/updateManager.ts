import { Cron } from "croner";
import { Unregisterable } from "@decky/ui/dist/globals/steam-client/shared";
import { update_decky_loader } from "./backend";
import { UpdateResult, UpdateStatus } from "../helpers/commonDefs";
import { readyForUpdate } from "./utils";
import Config from "./config";
import Logger from "./logger";
import Registeration from "../types/registration";

import { EUpdaterType } from "../deps/protobuf/enums_pb";
import { CMsgSystemUpdateState } from "../deps/protobuf/steammessages_client_objects_pb";
import { EUpdaterState } from "../deps/protobuf/enums_pb";

class UpdateManager extends Registeration {
  private schedule: Cron | undefined = undefined; // Cron object to start the update
  private updateTimeout: NodeJS.Timeout | undefined = undefined; // 1 hour timeout after update is started
  private updateStateChangeRegistration: Unregisterable | undefined = undefined; // handle of the update state change registration

  protected _register(): UnregisterFunction {
    const cronUpdateRegistration = Config.on("cron", this.updateSchedule);
    const cronStr = Config.get("cron");
    if (cronStr) {
      this.updateSchedule(cronStr, false);
    }

    return () => {
      cronUpdateRegistration.unregister();
      this.unregisterUpdateStateChangeRegistration();
      this.updateSchedule("", false);
    }
  }

  private updateSchedule = (cronExpression: string, logError: boolean = true): void => {
    this.schedule?.stop();
    this.schedule = undefined;
    try {
      this.schedule = new Cron(cronExpression, this.checkForUpdates);
      Logger.info("Cron schedule set to: " + cronExpression);
    } catch (e) {
      if (logError) {
        Logger.error("Failed to parse cron expression", e);
      }
    }
  }

  private unregisterUpdateStateChangeRegistration = (): void => {
    clearTimeout(this.updateTimeout);
    this.updateTimeout = undefined;
    this.updateStateChangeRegistration?.unregister();
    this.updateStateChangeRegistration = undefined;
  }

  private async updateDeckyLoader(): Promise<UpdateStatus> {
    const returnCode = await update_decky_loader();
    switch (returnCode) {
      case UpdateResult.UPDATED:
        Logger.info("Decky Loader updated successfully, pending restart");
        if (await readyForUpdate()) {
          return UpdateStatus.CLIENT_RESTART_REQUIRED;
        } else {
          Logger.info("System not ready for update, skipping...");
        }
      case UpdateResult.FAIL:
        Logger.error("Failed to update Decky Loader");
        break;
      case UpdateResult.NOT_UPDATED:
        Logger.debug("Decky Loader does not need update");
        break;
      default:
        Logger.error("Unknown return code: " + returnCode);
        break;
    }

    return UpdateStatus.UP_TO_DATE;
  }

  private checkForUpdates = async (): Promise<void> => {
    if (this.updateStateChangeRegistration !== undefined) {
      Logger.info("An update is in progress, skipping...");
      return;
    } else if (!(await readyForUpdate())) {
      Logger.info("System not ready for update, skipping...");
      return;
    }

    Logger.info("Checking for Decky Loader updates...");
    await this.handleRestart(await this.updateDeckyLoader());

    Logger.info("Checking for Steam updates...");
    this.updateStateChangeRegistration = SteamClient.Updates.RegisterForUpdateStateChanges(this.updateStateChangeHandler) as Unregisterable;
    // 1 hour timeout for updating, terminate gracefully if it exceeds that time
    this.updateTimeout = setTimeout(this.unregisterUpdateStateChangeRegistration, 60 * 60 * 1000);

    try {
      await SteamClient.Updates.CheckForUpdates();
    } catch (e) {
      Logger.error("Failed to check for updates:", e);
      this.unregisterUpdateStateChangeRegistration();
    }
  }

  private updateStateChangeHandler = (protoMsg: ArrayBuffer): void => {
    try {
      var updateState = CMsgSystemUpdateState.deserializeBinary(new Uint8Array(protoMsg)).toObject();
    } catch (e) {
      Logger.error("Failed to parse update state: " + e);
      this.unregisterUpdateStateChangeRegistration();
      return;
    }

    switch (updateState.state) {
      case EUpdaterState.K_EUPDATERSTATE_AVAILABLE:
        this.applyUpdates(updateState);
        return;
      case EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING:
      case EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING:
        this.handleRestart(this.processRestartPendingState(updateState));
        return;
      case EUpdaterState.K_EUPDATERSTATE_APPLYING:
      case EUpdaterState.K_EUPDATERSTATE_CHECKING:
        return;
      default:
        Logger.info("No updates available");
        break;
    }

    this.unregisterUpdateStateChangeRegistration();
  }

  private async handleRestart(updateStatus: UpdateStatus) {
    if (!(await readyForUpdate())) {
      Logger.info("System not ready for update, skipping...");
      return;
    }

    switch (updateStatus) {
      case UpdateStatus.UP_TO_DATE:
        break;
      case UpdateStatus.OS_RESTART_REQUIRED:
        Logger.info("Pending system restart, restarting...");
        SteamClient.System.RestartPC();
        break;
      case UpdateStatus.CLIENT_RESTART_REQUIRED:
        Logger.info("Pending client restart, restarting...");
        // SteamClient.User.StartRestart(); -> DeckyLoader workaround
        SteamClient.User.StartShutdown(false);
        break;
    }
  }

  private processRestartPendingState(updateState: CMsgSystemUpdateState.AsObject): UpdateStatus {
    if (updateState.state == EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING &&
      updateState.updateApplyResultsList.some(result => result.requiresSystemRestart) &&
      updateState.supportsOsUpdates) {
      return UpdateStatus.OS_RESTART_REQUIRED;
    } else if (updateState.state == EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING &&
      updateState.updateApplyResultsList.some(result => result.requiresClientRestart)) {
      return UpdateStatus.CLIENT_RESTART_REQUIRED;
    } else {
      Logger.error("Unexpected update state", updateState);
    }

    this.unregisterUpdateStateChangeRegistration();
    return UpdateStatus.UP_TO_DATE;
  }

  private applyUpdates(updateState: CMsgSystemUpdateState.AsObject): void {
    const availableUpdateTypes = updateState.updateCheckResultsList.filter(result => result.available && result.type).map(result => result.type as EUpdaterType);
    if (availableUpdateTypes.length === 0) {
      Logger.info("No updates available");
      this.unregisterUpdateStateChangeRegistration();
      return;
    }

    Logger.info("Applying updates of type", availableUpdateTypes);
    const updateArgString = availableUpdateTypes.map(type => '\b' + String.fromCharCode(type)).join("");
    const updateArg = btoa(updateArgString);
    SteamClient.Updates.ApplyUpdates(updateArg);
  }
}

const updateManager = new UpdateManager();
export default updateManager;
