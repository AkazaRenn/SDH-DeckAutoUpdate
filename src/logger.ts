import { call } from "@decky/api";
import * as deckyLogger from "./deps/logger";

const logName = "DeckAutoUpdate";

class Logger {
    async info(message: string): Promise<void> {
        deckyLogger.log(logName, message);
        call<[msg: string], void>("log_info", message);
    }

    async error(message: string): Promise<void> {
        deckyLogger.error(logName, message);
        call<[msg: string], void>("log_error", message);
    }

    async warning(message: string): Promise<void> {
        deckyLogger.warn(logName, message);
        call<[msg: string], void>("log_warning", message);
    }
}

const logger = new Logger();

export default logger;
