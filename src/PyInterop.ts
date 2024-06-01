import { ServerAPI } from "decky-frontend-lib";

export class PyInterop {
    private static serverAPI: ServerAPI;

    static setServer(serv: ServerAPI) {
        this.serverAPI = serv;
    }

    static get server() { return this.serverAPI; }

    static async logInfo(message: string): Promise<void> {
        console.info("[AutoUpdate][INF]" + message);
        this.serverAPI.callPluginMethod<{ msg: string }, void>("log_info", { msg: message });
    }

    static async logError(message: string): Promise<void> {
        console.error("[AutoUpdate][ERR]" + message);
        this.serverAPI.callPluginMethod<{ msg: string }, void>("log_error", { msg: message });
    }

    static async logWarning(message: string): Promise<void> {
        console.warn("[AutoUpdate][WRN]" + message);
        this.serverAPI.callPluginMethod<{ msg: string }, void>("log_warn", { msg: message });
    }

    static async setCron(cron: string): Promise<void> {
        PyInterop.logInfo("Updating cron: " + cron);
        this.serverAPI.callPluginMethod<{ cron: string }, void>("set_cron", { cron });
    }

    static async getCron(): Promise<string> {
        var response = await this.serverAPI.callPluginMethod<{}, string>("get_cron", {});
        if (response.success) {
            return response.result;
        }
        return "";
    }

    static async setMinBattery(minBattery: number): Promise<void> {
        PyInterop.logInfo("Updating min_battery: " + minBattery);
        this.serverAPI.callPluginMethod<{ min_battery: number }, void>("set_min_battery", { min_battery: minBattery });
    }

    static async getMinBattery(): Promise<number> {
        var response = await this.serverAPI.callPluginMethod<{}, number>("get_min_battery", {});
        if (response.success) {
            return response.result;
        }
        return -1;
    }

    static async getBatteryLevel(): Promise<number> {
        var response = await this.serverAPI.callPluginMethod<{}, number>("get_battery_level", {});
        if (response.success) {
            return response.result;
        }
        return 101;
    }

    static async getIsCharging(): Promise<boolean> {
        var response = await this.serverAPI.callPluginMethod<{}, boolean>("get_is_charging", {});
        if (response.success) {
            return response.result;
        }
        return true;
    }
}