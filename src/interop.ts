import { call } from "@decky/api";

export async function logInfo(message: string): Promise<void> {
    console.info("[AutoUpdate][INF]" + message);
    call<[msg: string], void>("log_info", message);
}

export async function logError(message: string): Promise<void> {
    console.error("[AutoUpdate][ERR]" + message);
    call<[msg: string], void>("log_error", message);
}

export async function logWarning(message: string): Promise<void> {
    console.warn("[AutoUpdate][WRN]" + message);
    call<[msg: string], void>("log_warn", message);
}

export async function setCron(cron: string): Promise<void> {
    logInfo("Updating cron: " + cron);
    call<[cron: string], void>("set_cron", cron);
}

export async function getCron(): Promise<string> {
    try {
        return await call<[], string>("get_cron");
    } catch (e) {
        logError("Failed to get cron: " + e);
        return "";
    }
}

export async function setMinBattery(minBattery: number): Promise<void> {
    logInfo("Updating min_battery: " + minBattery);
    call<[min_battery: number], void>("set_min_battery", minBattery);
}

export async function getMinBattery(): Promise<number> {
    try {
        return await call<[], number>("get_min_battery");
    } catch (e) {
        logError("Failed to get min_battery: " + e);
        return -1;
    }
}

export async function getBatteryLevel(): Promise<number> {
    try {
        return await call<[], number>("get_battery_level");
    } catch (e) {
        logError("Failed to get battery_level: " + e);
        return 101;
    }
}

export async function getIsCharging(): Promise<boolean> {
    try {
        return await call<[], boolean>("get_is_charging");
    } catch (e) {
        logError("Failed to get is_charging: " + e);
        return true;
    }
}
