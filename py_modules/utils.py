from pathlib import Path
import subprocess
import json

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
                return (f.read().strip() != "Discharging")
        except Exception as e:
            pass
    # No battery system, don't worry about it
    return True

def rpm_ostree_update():
    update_result = subprocess.run(["rpm-ostree", "update"])
    if update_result.returncode != 0:
        return -1

    status_result = subprocess.run(["rpm-ostree", "status", "--json"], capture_output=True)
    if status_result.returncode != 0:
        return -1

    status = json.loads(status_result.stdout)
    staged_version = ""
    booted_version = ""
    for deployment in status["deployments"]:
        if deployment["staged"]:
            staged_version = deployment["version"]
        elif deployment["booted"]:
            booted_version = deployment["version"]

    if staged_version <= booted_version:
        return 0
    else:
        logger.info("Update available from %s to %s", booted_version, staged_version)
        return 1