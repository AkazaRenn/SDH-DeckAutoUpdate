import { get_battery_level, get_is_charging } from "./backend";
import Logger from "./logger";
import Config from "./config";

export async function readyForUpdate(): Promise<boolean> {
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