import { Mutex } from "async-mutex";
import { UpdateStatus } from "./commonDefs";

class RestartManager {
  private readonly mutex = new Mutex();

  private _deckyLoaderUpdateStatus: UpdateStatus = UpdateStatus.UP_TO_DATE;
  set deckyLoaderUpdateStatus(status: UpdateStatus) {
    this.mutex
      .runExclusive(() => this._deckyLoaderUpdateStatus = status)
      .then(() => {
        if (status != UpdateStatus.IN_PROGERSS) {
          this.checkUpdateStatus();
        }
      });
  }

  private _steamUpdateStatus: UpdateStatus = UpdateStatus.UP_TO_DATE;
  set steamUpdateStatus(status: UpdateStatus) {
    this.mutex
      .runExclusive(() => {
        if (((this._steamUpdateStatus == UpdateStatus.CLIENT_RESTART_REQUIRED) || (this._steamUpdateStatus == UpdateStatus.OS_RESTART_REQUIRED)) && (status == UpdateStatus.UP_TO_DATE)) {
          return;
        }
        this._steamUpdateStatus = status;
      })
      .then(() => {
        if (status != UpdateStatus.IN_PROGERSS) {
          this.checkUpdateStatus();
        }
      });
  }

  private checkUpdateStatus = (): void => {
    this.mutex.runExclusive(() => {
      if ((this._deckyLoaderUpdateStatus == UpdateStatus.IN_PROGERSS) || (this._steamUpdateStatus == UpdateStatus.IN_PROGERSS)) {
        return;
      } else if ((this._deckyLoaderUpdateStatus == UpdateStatus.OS_RESTART_REQUIRED) || (this._steamUpdateStatus == UpdateStatus.OS_RESTART_REQUIRED)) {
        SteamClient.System.RestartPC();
      } else if ((this._deckyLoaderUpdateStatus == UpdateStatus.CLIENT_RESTART_REQUIRED) || (this._steamUpdateStatus == UpdateStatus.CLIENT_RESTART_REQUIRED)) {
        this.restartSteam();
      }
    });
  }

  private restartSteam() {
    // SteamClient.User.StartRestart(); -> DeckyLoader workaround
    SteamClient.User.StartShutdown(false);
  }
}

const restartManager = new RestartManager();
export default restartManager;
