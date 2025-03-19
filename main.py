from pathlib import Path
from typing import Any

from common_defs import *
from config import Config

class Plugin:
    async def get_config(self) -> dict[str, Any]:
        logger.debug("Executing get_config()")
        return Config.get_config()

    async def set_config(self, key: str, value: Any):
        logger.debug("Executing set_config(key=%s, value=%s)", key, value)
        Config.set_config(key, value)

    async def get_battery_level(self) -> int:
        logger.debug("Executing get_battery_level()")

        battery_path = _get_battery_path()
        if battery_path and (battery_path / "capacity").exists():
            try:
                with open(battery_path / "capacity", "r") as f:
                    return int(f.read().strip())
            except Exception as e:
                pass
        # No battery system, return an unbearable number
        return 101

    async def get_is_charging(self) -> bool:
        logger.debug("Executing get_is_charging()")

        battery_path = _get_battery_path()
        if battery_path and (battery_path / "status").exists():
            try:
                with open(battery_path / "status", "r") as f:
                    return (f.read().strip() != "Discharging")
            except Exception as e:
                pass
        # No battery system, don't worry about it
        return True

    async def log_debug(self, msg: str):
        logger.debug(msg)

    async def log_info(self, msg: str):
        logger.info(msg)

    async def log_error(self, msg: str):
        logger.error(msg)

    async def log_warning(self, msg: str):
        logger.warning(msg)

def _get_battery_path():
    power_supply = Path("/sys/class/power_supply/")
    battery_list = sorted(power_supply.glob("BAT*"))
    if battery_list:
        return battery_list[0]
    return None
