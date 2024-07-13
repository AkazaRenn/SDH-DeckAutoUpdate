import { ServerAPI } from "decky-frontend-lib";

var serverAPI: ServerAPI;

export function setServer(serv: ServerAPI) {
    serverAPI = serv;
}

export async function logInfo(message: string): Promise<void> {
    console.info("[AutoUpdate][INF]" + message);
    serverAPI.callPluginMethod<{ msg: string }, void>("log_info", { msg: message });
}

export async function logError(message: string): Promise<void> {
    console.error("[AutoUpdate][ERR]" + message);
    serverAPI.callPluginMethod<{ msg: string }, void>("log_error", { msg: message });
}

export async function logWarning(message: string): Promise<void> {
    console.warn("[AutoUpdate][WRN]" + message);
    serverAPI.callPluginMethod<{ msg: string }, void>("log_warn", { msg: message });
}

export async function setCron(cron: string): Promise<void> {
    logInfo("Updating cron: " + cron);
    serverAPI.callPluginMethod<{ cron: string }, void>("set_cron", { cron });
}

export async function getCron(): Promise<string> {
    var response = await serverAPI.callPluginMethod<{}, string>("get_cron", {});
    if (response.success) {
        return response.result;
    }
    return "";
}

export async function setMinBattery(minBattery: number): Promise<void> {
    logInfo("Updating min_battery: " + minBattery);
    serverAPI.callPluginMethod<{ min_battery: number }, void>("set_min_battery", { min_battery: minBattery });
}

export async function getMinBattery(): Promise<number> {
    var response = await serverAPI.callPluginMethod<{}, number>("get_min_battery", {});
    if (response.success) {
        return response.result;
    }
    return -1;
}

export async function getBatteryLevel(): Promise<number> {
    var response = await serverAPI.callPluginMethod<{}, number>("get_battery_level", {});
    if (response.success) {
        return response.result;
    }
    return 101;
}

export async function getIsCharging(): Promise<boolean> {
    var response = await serverAPI.callPluginMethod<{}, boolean>("get_is_charging", {});
    if (response.success) {
        return response.result;
    }
    return true;
}
