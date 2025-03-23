import { Cron } from "croner";
import { get_battery_level, get_is_charging, rpm_ostree_update } from "./backend";
import Config from "./config";
import Logger from "./logger";
import Registeration from "../types/registration";

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
    clearTimeout(this.updateTimeout);
    this.updateTimeout = undefined;
    this.updateStateChangeRegistration?.unregister();
    this.updateStateChangeRegistration = undefined;
  }

  private checkForUpdates = async (): Promise<void> => {
    if (this.updateStateChangeRegistration !== undefined) {
      Logger.info("An update is in progress, skipping...");
      return;
    } else if (!(await this.readyForUpdate())) {
      Logger.info("System not ready for update, skipping...");
      return;
    }

    Logger.info("Checking for updates...");
    this.updateStateChangeRegistration = SteamClient.Updates.RegisterForUpdateStateChanges(this.updateStateChangeHandler) as Unregisterable;
    // 1 hour timeout for updating, terminate gracefully if it exceeds that time
    this.updateTimeout = setTimeout(this.unregisterUpdateStateChangeRegistration, 60 * 60 * 1000);
    SteamClient.Updates.CheckForUpdates().catch((e: any) => {
      Logger.error("Failed to check for updates: " + e);
      this.unregisterUpdateStateChangeRegistration();
    })
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
        break;
      case EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING:
      case EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING:
        this.handleRestartPending(updateState);
        break;
      case EUpdaterState.K_EUPDATERSTATE_APPLYING:
      case EUpdaterState.K_EUPDATERSTATE_CHECKING:
        break;
      default:
        Logger.info("No updates available");
        this.unregisterUpdateStateChangeRegistration();
        break;
    }
  }

  private handleRestartPending(updateState: CMsgSystemUpdateState.AsObject): void {
    this.readyForUpdate().then((ready) => {
      if (!ready) {
        Logger.info("System not ready for update, skipping...");
      } else if (updateState.state == EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING &&
        updateState.updateApplyResultsList.some(result => result.requiresSystemRestart) &&
        updateState.supportsOsUpdates) {
        Logger.info("Pending system restart, restarting...");
        SteamClient.System.RestartPC();
      } else if (updateState.state == EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING &&
        updateState.updateApplyResultsList.some(result => result.requiresClientRestart)) {
        Logger.info("Pending client restart, restarting...");
        SteamClient.User.StartRestart(false);
      } else {
        Logger.error("Unexpected update state", updateState);
      }
    });

    this.unregisterUpdateStateChangeRegistration();
  }

  private applyUpdates(updateState: CMsgSystemUpdateState.AsObject): void {
    var osUpdateAvailable = false;

    if (updateState.supportsOsUpdates) {
      for (var checkResult of updateState.updateCheckResultsList) {
        if (checkResult.available && checkResult.type) {
          switch (checkResult.type) {
            case EUpdaterType.K_EUPDATERTYPE_OS:
            case EUpdaterType.K_EUPDATERTYPE_BIOS:
            case EUpdaterType.K_EUPDATERTYPE_AGGREGATED:
              osUpdateAvailable = true;
              break;
            default:
              break;
          }
        }
      }
    }

    if (osUpdateAvailable) {
      const osUpdateHandler = Config.get("os_update_handler");
      Logger.info("OS update availbale, applying...");
      switch (osUpdateHandler) {
        case this.osUpdateHandler.STEAM:
          SteamClient.Updates.ApplyUpdates("CAI=");
          break;
        case this.osUpdateHandler.RPM_OSTREE:
          this.unregisterUpdateStateChangeRegistration();
          rpm_ostree_update().then((returnCode: number) => {
            switch (returnCode) {
              case -1:
                Logger.error("Failed to update OS");
                break;
              case 0:
                Logger.warning("Updated to the same version somehow");
                break;
              case 1:
                Logger.info("OS updated successfully, pending restart");
                this.handleRestartPending({
                  state: EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING,
                  updateCheckResultsList: [],
                  updateApplyResultsList: [{
                    requiresSystemRestart: true,
                  }],
                });
                break;
              default:
                Logger.error("Unknown return code: " + returnCode);
                break;
            }
          });
          break;
        default:
          Logger.error("Unknown OS update handler: " + osUpdateHandler);
          this.unregisterUpdateStateChangeRegistration();
          break;
      }
    } else {
      Logger.info("Client update available, applying...");
      SteamClient.Updates.ApplyUpdates("CAE=");
    }
  }

  private async readyForUpdate(): Promise<boolean> {
    if (window.NotificationStore.BIsUserInGame()) {
      Logger.info("User in game");
      return false;
    }
    if (((await get_battery_level()) < Config.get("min_battery")) && (!(await get_is_charging()))) {
      Logger.warning("Battery level low");
      return false;
    }
    return true;
  }
}

const updateManager = new UpdateManager();
export default updateManager;
