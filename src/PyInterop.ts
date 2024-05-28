import { ServerAPI, ServerResponse } from "decky-frontend-lib";

export class PyInterop {
    private static serverAPI: ServerAPI;

    static setServer(serv: ServerAPI) {
        this.serverAPI = serv;
    }

    static get server() { return this.serverAPI; }

    static async logInfo(message: string): Promise<ServerResponse<void>> {
        console.info("[AutoUpdate][INF]" + message);
        return await this.serverAPI.callPluginMethod<{ message: string }, void>("log_info", { message });
    }

    static async logError(message: string): Promise<ServerResponse<void>> {
        console.error("[AutoUpdate][ERR]" + message);
        return await this.serverAPI.callPluginMethod<{ message: string }, void>("log_error", { message });
    }

    static async logWarning(message: string): Promise<ServerResponse<void>> {
        console.warn("[AutoUpdate][WRN]" + message);
        return await this.serverAPI.callPluginMethod<{ message: string }, void>("log_warn", { message });
    }

    static async setCron(cron: string): Promise<ServerResponse<void>> {
        PyInterop.logInfo("Updating cron: " + cron);
        return await this.serverAPI.callPluginMethod<{ cron: string }, void>("set_cron", { cron });
    }

    static async getCron(): Promise<ServerResponse<string>> {
        return await this.serverAPI.callPluginMethod<{}, string>("get_cron", {});
    }
}