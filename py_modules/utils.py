from pathlib import Path
from packaging.version import Version
from typing import Any, Tuple
import json
import importlib.metadata
import urllib.request

from common_defs import *


def _get_battery_path():
    power_supply = Path("/sys/class/power_supply/")
    battery_list = sorted(power_supply.glob("BAT*"))
    if battery_list:
        return battery_list[0]
    return None


def get_battery_level() -> int:
    battery_path = _get_battery_path()
    if battery_path and (battery_path / "capacity").exists():
        try:
            with open(battery_path / "capacity", "r") as f:
                return int(f.read().strip())
        except Exception:
            pass
    # No battery system, return an unbearable number
    return 101


def get_is_charging() -> bool:
    battery_path = _get_battery_path()
    if battery_path and (battery_path / "status").exists():
        try:
            with open(battery_path / "status", "r") as f:
                return f.read().strip() != "Discharging"
        except Exception:
            pass
    # No battery system, don't worry about it
    return True


def _get_decky_loader_branch() -> DeckyLoaderBranch:
    try:
        decky_loader_config = Path(
            f"{decky.DECKY_PLUGIN_SETTINGS_DIR}/../loader.json"
        ).resolve()
        with decky_loader_config.open("r", encoding="utf-8") as f:
            loader_config = json.load(f)

        if loader_config.get("branch") == 1:
            return DeckyLoaderBranch.PRE_RELEASE

    except Exception as e:
        logger.warning("Failed to execute _get_decky_loader_branch(): %s", str(e))

    return DeckyLoaderBranch.STABLE


def update_decky_loader() -> UpdateResult:
    try:
        latest_version, release = _get_available_loader_version()
        logger.info("Latest Decky Loader version: %s", latest_version)
        current_version = _get_current_loader_version()
        logger.info("Current Decky Loader version: %s", current_version)

        if (latest_version > current_version) and release:
            logger.info("Updating Decky Loader")
            for asset in release.get("assets"):
                if asset.get("name") == "PluginLoader":
                    bin_url = asset.get("browser_download_url")
                    with urllib.request.urlopen(bin_url, context=ssl_context) as response:
                        if response.status == 200:
                            with open(
                                f"{decky.DECKY_HOME}/services/PluginLoader", "wb"
                            ) as file:
                                file.write(response.read())
                                return UpdateResult.UPDATED
                        else:
                            logger.error(
                                "Failed to download the latest Decky Loader binary, response: %d",
                                response.status,
                            )
                            return UpdateResult.FAIL
            else:
                logger.error("Failed to find the latest Decky Loader binary")
                return UpdateResult.FAIL

    except Exception as e:
        logger.error("Failed to execute update_decky_loader(): %s", str(e))
        return UpdateResult.FAIL

    return UpdateResult.NOT_UPDATED


def _get_current_loader_version() -> Version:
    try:
        # Normalize Python-style version to conform to Decky style
        version = Version(importlib.metadata.version("decky_loader"))
        return version
    except Exception as e:
        logger.warning("Failed to execute _get_current_loader_version(): %s", str(e))
        return DEFAULT_VERSION


def _get_available_loader_version() -> Tuple[Version, Any]:
    try:
        looking_for_pre_release = (
            _get_decky_loader_branch() == DeckyLoaderBranch.PRE_RELEASE
        )

        release = _get_latest_decky_loader_release(looking_for_pre_release)
        return Version(release.get("tag_name")), release

    except Exception as e:
        logger.warning("Failed to execute _get_available_loader_version(): %s", str(e))

    return DEFAULT_VERSION, None


def _get_latest_decky_loader_release(pre_release: bool) -> Any:
    try:
        url = "https://api.github.com/repos/SteamDeckHomebrew/decky-loader/releases"
        with urllib.request.urlopen(url, context=ssl_context) as response:
            if response.status == 200:
                data = response.read().decode("utf-8")
                releases = json.loads(data)
            else:
                logger.warning(
                    "Failed to fetch releases from GitHub: %d", response.status
                )
                return None

        for release in releases:
            if pre_release or (not release.get("prerelease")):
                return release

    except Exception as e:
        logger.warning(
            "Failed to execute _get_latest_decky_loader_release(): %s", str(e)
        )

    return None
