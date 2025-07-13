from pathlib import Path
from packaging.version import Version
import subprocess
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
    latest_version = _get_available_loader_version()
    logger.info("Latest Decky Loader version: %s", latest_version)
    current_version = _get_current_loader_version()
    logger.info("Current Decky Loader version: %s", current_version)

    if latest_version > current_version:
        logger.info("Updating Decky Loader")
        result = subprocess.run(
            f"curl -L https://github.com/SteamDeckHomebrew/decky-installer/raw/refs/heads/main/cli/decky-updater.sh | sh -s {_get_decky_loader_branch().value}",
            shell=True,
        )
        if result.returncode == 0:
            return UpdateResult.UPDATED
        else:
            logger.error(
                "Failed to update Decky Loader with exit code %d: %s",
                result.returncode,
                result.stderr,
            )
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


def _get_available_loader_version() -> Version:
    try:
        looking_for_pre_release = (
            _get_decky_loader_branch() == DeckyLoaderBranch.PRE_RELEASE
        )

        url = "https://api.github.com/repos/SteamDeckHomebrew/decky-loader/releases"
        with urllib.request.urlopen(url, context=ssl_context) as response:
            if response.status == 200:
                data = response.read().decode("utf-8")
                releases = json.loads(data)
            else:
                logger.warning(
                    "Failed to fetch releases from GitHub: %d", response.status
                )
                return DEFAULT_VERSION

        for release in releases:
            if looking_for_pre_release or (not release.get("prerelease")):
                return Version(release.get("tag_name"))

    except Exception as e:
        logger.warning("Failed to execute _get_available_loader_version(): %s", str(e))

    return DEFAULT_VERSION
