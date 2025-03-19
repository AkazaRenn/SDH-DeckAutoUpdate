import { Cron } from "croner";
import { get_battery_level, get_is_charging } from "./backend";
import Config from "./config";
import Logger from "./logger";

import { EUpdaterType } from "../deps/protobuf/enums_pb";
import { CMsgSystemUpdateState } from "../deps/protobuf/steammessages_client_objects_pb";
import { EUpdaterState } from "../deps/protobuf/enums_pb";

export default class UpdateManager {
  private schedule: Cron | undefined = undefined; // Cron object to start the update
  private updateTimeout: NodeJS.Timeout | undefined = undefined; // 1 hour timeout after update is started
  private updateStateChangeRegistration: Unregisterable | undefined = undefined; // handle of the update state change registration
  readonly registrations: Array<Unregisterable> = [];

  public constructor() {
    this.updateSchedule(Config.get("cron"), false);
  }

  private updateSchedule(cronExpression: string,
    updateSettings: boolean = true,
    logError: boolean = true
  ): void {
    if (updateSettings) {
      Config.set("cron", cronExpression);
    }

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

  public unregisterUpdateStateChangeRegistration(): void {
    clearTimeout(this.updateTimeout);
    this.updateTimeout = undefined;
    this.updateStateChangeRegistration?.unregister();
    this.updateStateChangeRegistration = undefined;
  }

  private async checkForUpdates(): Promise<void> {
    if (this.updateStateChangeRegistration) {
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

  private updateStateChangeHandler(protoMsg: Uint8Array): void {
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
      if (ready) {
        Logger.info("System not ready for update, skipping...");
      } else if (updateState.state == EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING &&
        updateState.updateApplyResultsList.some(result => result.requiresSystemRestart) &&
        updateState.supportsOsUpdates) {
        Logger.info("Pending system restart, restarting...");
        SteamClient.System.RestartPC();
      } else if (updateState.state == EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING &&
        updateState.updateApplyResultsList.some(result => result.requiresClientRestart)) {
        Logger.info("Pending client restart, restarting...");
        SteamClient.User.StartRestart();
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
      Logger.info("OS update availbale, applying...");
      SteamClient.Updates.ApplyUpdates("CAI=");
    } else {
      Logger.info("Client update available, applying...");
      SteamClient.Updates.ApplyUpdates("CAE=");
    }
  }

  private async readyForUpdate() {
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
