import { Cron } from "croner";
import { rpm_ostree_update, update_decky_loader } from "./backend";
import { MOCK_OS_UPDATE_STATE, UpdateResult, UpdateStatus } from "../helpers/commonDefs";
import { readyForUpdate } from "./utils";
import Config from "./config";
import Logger from "./logger";
import Registeration from "../types/registration";
import RestartManager from "./restartManager";

import { EUpdaterType } from "../deps/protobuf/enums_pb";
import { CMsgSystemUpdateState } from "../deps/protobuf/steammessages_client_objects_pb";
import { EUpdaterState } from "../deps/protobuf/enums_pb";

class UpdateManager extends Registeration {
  private readonly osUpdateHandler = {
    STEAM: "steam",
    RPM_OSTREE: "rpm-ostree",
  } as const;

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
    RestartManager.steamUpdateStatus = UpdateStatus.UP_TO_DATE;
    clearTimeout(this.updateTimeout);
    this.updateTimeout = undefined;
    this.updateStateChangeRegistration?.unregister();
    this.updateStateChangeRegistration = undefined;
  }

  private async updateDeckyLoader() {
    const returnCode = await update_decky_loader();
    switch (returnCode) {
      case UpdateResult.UPDATED:
        Logger.info("Decky Loader updated successfully, pending restart");
        readyForUpdate().then((ready) => {
          if (ready) {
            RestartManager.deckyLoaderUpdateStatus = UpdateStatus.CLIENT_RESTART_REQUIRED;
          } else {
            Logger.info("System not ready for update, skipping...");
          }
        });
        return;
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

    RestartManager.deckyLoaderUpdateStatus = UpdateStatus.UP_TO_DATE;
  }

  private checkForUpdates = async (): Promise<void> => {
    if (this.updateStateChangeRegistration !== undefined) {
      Logger.info("An update is in progress, skipping...");
      return;
    } else if (!(await readyForUpdate())) {
      Logger.info("System not ready for update, skipping...");
      return;
    }

    Logger.info("Checking for updates...");
    this.updateStateChangeRegistration = SteamClient.Updates.RegisterForUpdateStateChanges(this.updateStateChangeHandler) as Unregisterable;
    // 1 hour timeout for updating, terminate gracefully if it exceeds that time
    this.updateTimeout = setTimeout(this.unregisterUpdateStateChangeRegistration, 60 * 60 * 1000);

    RestartManager.steamUpdateStatus = UpdateStatus.IN_PROGERSS;
    RestartManager.deckyLoaderUpdateStatus = UpdateStatus.IN_PROGERSS;
    SteamClient.Updates.CheckForUpdates().catch((e: any) => {
      Logger.error("Failed to check for updates:", e);
      this.unregisterUpdateStateChangeRegistration();
    })
    this.updateDeckyLoader();
  };

  private updateStateChangeHandler = (protoMsg: Uint8Array): void => {
    try {
      var updateState = CMsgSystemUpdateState.deserializeBinary(protoMsg).toObject();
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
        this.handleRestartPending(updateState);
        return;
      case EUpdaterState.K_EUPDATERSTATE_APPLYING:
      case EUpdaterState.K_EUPDATERSTATE_CHECKING:
        break;
      default:
        Logger.info("No updates available");
        break;
    }

    this.unregisterUpdateStateChangeRegistration();
  }

  private handleRestartPending(updateState: CMsgSystemUpdateState.AsObject): void {
    readyForUpdate().then((ready) => {
      if (!ready) {
        Logger.info("System not ready for update, skipping...");
      } else if (updateState.state == EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING &&
        updateState.updateApplyResultsList.some(result => result.requiresSystemRestart) &&
        updateState.supportsOsUpdates) {
        Logger.info("Pending system restart, restarting...");
        RestartManager.steamUpdateStatus = UpdateStatus.OS_RESTART_REQUIRED;
        return;
      } else if (updateState.state == EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING &&
        updateState.updateApplyResultsList.some(result => result.requiresClientRestart)) {
        Logger.info("Pending client restart, restarting...");
        RestartManager.steamUpdateStatus = UpdateStatus.CLIENT_RESTART_REQUIRED;
        return;
      } else {
        Logger.error("Unexpected update state", updateState);
      }

      this.unregisterUpdateStateChangeRegistration();
    });
  }

  private applyUpdates(updateState: CMsgSystemUpdateState.AsObject): void {
    const availableUpdateTypes = updateState.updateCheckResultsList.filter(result => result.available && result.type).map(result => result.type as EUpdaterType);
    if (availableUpdateTypes.length === 0) {
      Logger.info("No updates available");
      this.unregisterUpdateStateChangeRegistration();
      return;
    }

    // Workaround for Bazzite, update OS first and leave everything else for then next run
    const osUpdateAvailable = availableUpdateTypes.some(type => type == EUpdaterType.K_EUPDATERTYPE_OS);
    if (osUpdateAvailable && Config.get("os_update_handler") == this.osUpdateHandler.RPM_OSTREE) {
      rpm_ostree_update().then((returnCode: number) => {
        switch (returnCode) {
          case UpdateResult.FAIL:
            Logger.error("Failed to update OS");
            break;
          case UpdateResult.NOT_UPDATED:
            Logger.warning("Updated to the same version somehow");
            break;
          case UpdateResult.UPDATED:
            Logger.info("OS updated successfully, pending restart");
            this.handleRestartPending(MOCK_OS_UPDATE_STATE);
            break;
          default:
            Logger.error("Unknown return code: " + returnCode);
            break;
        }
      });
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
