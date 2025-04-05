import { PLUGIN_NAME_NO_SPACE } from "./commonDefs";
import {
    log_debug,
    log_error,
    log_info,
    log_warning,
} from "./backend";
import DeckyLogger from "../deps/decky_logger";

class Logger extends DeckyLogger {
    async debug(...args: any[]) {
        super.debug(...args);
        log_debug(args.map(e => e?.toString()).join(' '));
    }

    async info(...args: any[]) {
        super.log(...args);
        log_info(args.map(e => e?.toString()).join(' '));
    }

    async error(...args: any[]) {
        super.error(...args);
        log_error(args.map(e => e?.toString()).join(' '));
    }

    async warning(...args: any[]) {
        super.warn(...args);
        log_warning(args.map(e => e?.toString()).join(' '));
    }
}

const logger = new Logger(PLUGIN_NAME_NO_SPACE);
export default logger;