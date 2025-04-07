import { callable } from "@decky/api"

export const get_config = callable<[], object>("get_config");
export const set_config = callable<[key: string, value: any], void>("set_config");
export const log_debug = callable<[string], void>("log_debug");
export const log_info = callable<[string], void>("log_info");
export const log_warning = callable<[string], void>("log_warning");
export const log_error = callable<[string], void>("log_error");
export const get_battery_level = callable<[], number>("get_battery_level");
export const get_is_charging = callable<[], boolean>("get_is_charging");
export const rpm_ostree_update = callable<[], number>("rpm_ostree_update");
export const update_decky_loader = callable<[], number>("update_decky_loader");