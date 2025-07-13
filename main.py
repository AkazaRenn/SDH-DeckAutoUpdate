from typing import Any

from common_defs import *
import utils
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
        return utils.get_battery_level()

    async def get_is_charging(self) -> bool:
        logger.debug("Executing get_is_charging()")
        return utils.get_is_charging()

    async def update_decky_loader(self) -> int:
        logger.debug("Executing update_decky_loader()")
        return utils.update_decky_loader().value

    async def log_debug(self, msg: str):
        logger.debug(msg)

    async def log_info(self, msg: str):
        logger.info(msg)

    async def log_error(self, msg: str):
        logger.error(msg)

    async def log_warning(self, msg: str):
        logger.warning(msg)

    async def _main(self):
        logger_level = Config.get_config_item("log_level")
        logger.setLevel(logger_level)
