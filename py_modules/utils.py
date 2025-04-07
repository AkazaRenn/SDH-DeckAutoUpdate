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
        except Exception as e:
            pass
    # No battery system, return an unbearable number
    return 101


def get_is_charging() -> bool:
    battery_path = _get_battery_path()
    if battery_path and (battery_path / "status").exists():
        try:
            with open(battery_path / "status", "r") as f:
                return f.read().strip() != "Discharging"
        except Exception as e:
            pass
    # No battery system, don't worry about it
    return True


def rpm_ostree_update() -> UpdateResult:
    update_result = subprocess.run(
        ["env", "-u", "LD_LIBRARY_PATH", "rpm-ostree", "update"],
        capture_output=True,
        text=True,
    )
    logger.debug("rpm-ostree update stdout: %s", update_result.stdout)
    logger.debug("rpm-ostree update stderr: %s", update_result.stderr)
    if update_result.returncode != 0:
        logger.warning(
            "rpm-ostree update failed with code %d", update_result.returncode
        )
        return UpdateResult.FAIL

    status_result = subprocess.run(
        ["env", "-u", "LD_LIBRARY_PATH", "rpm-ostree", "status", "--json"],
        capture_output=True,
        text=True,
    )
    if status_result.returncode != 0:
        logger.warning(
            "rpm-ostree status failed with code %d", status_result.returncode
        )
        return UpdateResult.FAIL

    status = json.loads(status_result.stdout)
    staged_version = ""
    booted_version = ""
    for deployment in status["deployments"]:
        if deployment["staged"]:
            staged_version = deployment["version"]
        elif deployment["booted"]:
            booted_version = deployment["version"]

    logger.debug(
        "staged_version: %s, booted_version:%s", staged_version, booted_version
    )
    if staged_version <= booted_version:
        return UpdateResult.NOT_UPDATED
    else:
        logger.info("Update available from %s to %s", booted_version, staged_version)
        return UpdateResult.UPDATED


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
    if _get_available_loader_version() > _get_current_loader_version():
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


def _get_current_loader_version() -> str:
    try:
        # Normalize Python-style version to conform to Decky style
        v = Version(importlib.metadata.version("decky_loader"))
        if v.major == 0 and v.minor == 0 and v.micro == 0:
            # We are probably running from source
            return "dev"

        version_str = f"v{v.major}.{v.minor}.{v.micro}"

        if v.pre:
            version_str += f"-pre{v.pre[1]}"

        if v.post:
            version_str += f"-dev{v.post}"

        logger.info("Current Decky Loader version: %s", version_str)
        return version_str
    except Exception as e:
        logger.warning("Failed to execute _get_current_loader_version(): %s", str(e))
        return ""


def _get_available_loader_version() -> str:
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
                return ""

        for release in releases:
            if looking_for_pre_release or (not release.get("prerelease")):
                logger.info("Latest Decky Loader version: %s", release.get("tag_name"))
                return release.get("tag_name")

    except Exception as e:
        logger.warning("Failed to execute _get_available_loader_version(): %s", str(e))

    return ""
