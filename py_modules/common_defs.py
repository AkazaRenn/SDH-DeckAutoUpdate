import decky

from pathlib import Path
from enum import Enum
from packaging.version import Version
import ssl, certifi

PLUGIN_DEFAULT_CONFIG_PATH = Path(decky.DECKY_PLUGIN_DIR) / "default_config.json"
PLUGIN_CONFIG_DIR = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)

DEFAULT_VERSION = Version("0")

class UpdateResult(Enum):
    FAIL = -1
    UPDATED = 0
    NOT_UPDATED=1

class DeckyLoaderBranch(Enum):
    STABLE = "s"
    PRE_RELEASE = "p"

logger = decky.logger
ssl_context = ssl.create_default_context(cafile=certifi.where())
