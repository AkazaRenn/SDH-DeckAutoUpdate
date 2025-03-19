import decky

from pathlib import Path

PLUGIN_DEFAULT_CONFIG_PATH = Path(decky.DECKY_PLUGIN_DIR) / "default_config.json"
PLUGIN_CONFIG_DIR = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)

logger = decky.logger
