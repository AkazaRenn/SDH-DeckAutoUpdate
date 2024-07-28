import { call } from "@decky/api";
import DeckyLogger from "./deps/logger";

class Logger extends DeckyLogger {
    async info(message: string) {
        super.log(message);
        call<[msg: string], void>("log_info", message);
    }

    async error(message: string) {
        super.error(message);
        call<[msg: string], void>("log_error", message);
    }

    async warning(message: string) {
        super.warn(message);
        call<[msg: string], void>("log_warning", message);
    }
}

const logger = new Logger("DeckAutoUpdate");

export default logger;
