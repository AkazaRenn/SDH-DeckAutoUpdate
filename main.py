import os
from settings import SettingsManager as settings_manager

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code one directory up
# or add the `decky-loader/plugin` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky_plugin

decky_plugin.logger.setLevel(decky_plugin.logging.INFO)

settings = settings_manager(name="config", settings_directory=decky_plugin.DECKY_PLUGIN_SETTINGS_DIR)
settings.read()

class Plugin:
    async def log_info(self, msg: str):
        decky_plugin.logger.info(msg)

    async def log_error(self, msg: str):
        decky_plugin.logger.error(msg)

    async def log_warn(self, msg: str):
        decky_plugin.logger.warning(msg)

    async def set_cron(self, cron: str):
        return settings.setSetting("cron", cron)

    async def get_cron(self):
        return settings.getSetting("cron")
