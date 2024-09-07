import {
  definePlugin,
  showModal,
  ButtonItem,
  ConfirmModal,
  PanelSection,
  PanelSectionRow,
  SliderField,
  TextField,
} from "@decky/ui";
import * as interop from "./interop";
import log from "./logger";
import { useEffect, useRef, useState } from "react";
import { FaRegArrowAltCircleUp } from "react-icons/fa";
import { EUpdaterType } from "../deps/protobuf/out/enums_pb";
import { CMsgSystemUpdateState } from "../deps/protobuf/out/steammessages_client_objects_pb";
import { EUpdaterState } from "../deps/protobuf/out/enums_pb";
import { Cron } from "croner";

// Global variables
var schedule: any = null; // Cron object to start the update
var updateTimeout: any = null; // 1 hour timeout after update is started
var updateStateChangeRegistration: any = null; // handle of the update state change registration

function Content() {
  const initializaing = useRef(true);

  var cronText = "";
  const [cronText_Display, setCronText_Display] = useState(cronText);
  const [minBattery_Display, setMinBattery_Display] = useState(-1);

  useEffect(() => {
    if (initializaing.current) {
      initializaing.current = false;
      interop.getCron().then(response => {
        setCronText_Display(response);
      })
      interop.getMinBattery().then(response => {
        setMinBattery_Display(response);
      })
    }
  });

  return (
    <div>
      <PanelSection>
        <PanelSectionRow>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ButtonItem
              bottomSeparator="none"
              onClick={() => {
                showModal(
                  <ConfirmModal
                    strTitle="Update Schedule"
                    strDescription="Enter the cron expression, put anything invalid or leave it empty to disable"
                    onOK={() => {
                      updateSchedule(cronText);
                      setCronText_Display(cronText);
                    }}>
                    <TextField
                      defaultValue={cronText_Display}
                      onChange={(e) => cronText = e.target.value}
                      onBlur={(e) => cronText = e.target.value} />
                  </ConfirmModal>
                );
              }}>
              {cronText_Display ? cronText_Display : "Add"}
            </ButtonItem>
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <SliderField
            bottomSeparator="none"
            label={"Min Update Battery"}
            min={20}
            max={100}
            value={Math.max(minBattery_Display, 0)}
            valueSuffix={"%"}
            showValue={true}
            onChange={async (value) => {
              setMinBattery_Display(value);
              await interop.setMinBattery(value);
            }}
            step={5}
            notchTicksVisible={false}
          />
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};

function updateSchedule(cronExpression: string,
  updateSettings: boolean = true,
  logError: boolean = true
): void {
  if (updateSettings) {
    interop.setCron(cronExpression);
  }

  schedule?.stop();
  schedule = null;
  try {
    schedule = Cron(cronExpression, checkForUpdates);
    log.info("Cron schedule set to: " + cronExpression);
  } catch (e) {
    if (logError) {
      log.error("Failed to parse cron expression", e);
    }
  }
}

function unregisterUpdateStateChangeRegistration(): void {
  clearTimeout(updateTimeout);
  updateTimeout = null;
  updateStateChangeRegistration?.unregister();
  updateStateChangeRegistration = null;
}

async function checkForUpdates(): Promise<void> {
  if (updateStateChangeRegistration) {
    log.info("An update is in progress, skipping...");
    return;
  } else if (!readyForUpdate()) {
    log.info("System not ready for update, skipping...");
    return;
  }

  log.info("Checking for updates...");
  updateStateChangeRegistration = SteamClient.Updates.RegisterForUpdateStateChanges(updateStateChangeHandler);
  // 1 hour timeout for updating, terminate gracefully if it exceeds that time
  updateTimeout = setTimeout(unregisterUpdateStateChangeRegistration, 60 * 60 * 1000);
  SteamClient.Updates.CheckForUpdates().catch((e: any) => {
    log.error("Failed to check for updates: " + e);
    unregisterUpdateStateChangeRegistration();
  })
};

function updateStateChangeHandler(protoMsg: Uint8Array): void {
  try {
    var updateState = CMsgSystemUpdateState.deserializeBinary(protoMsg).toObject();
  } catch (e) {
    log.error("Failed to parse update state: " + e);
    unregisterUpdateStateChangeRegistration();
    return;
  }

  switch (updateState.state) {
    case EUpdaterState.K_EUPDATERSTATE_AVAILABLE:
      applyUpdates(updateState);
      break;
    case EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING:
      handleOsUpdateApplication(updateState);
      break;
    case EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING:
      if (readyForUpdate()) {
        log.info("Pending client restart, restarting...");
        SteamClient.User.StartRestart();
      } else {
        log.info("System not ready for update, skipping...");
        unregisterUpdateStateChangeRegistration();
      }
      break;
    case EUpdaterState.K_EUPDATERSTATE_APPLYING:
    case EUpdaterState.K_EUPDATERSTATE_CHECKING:
      break;
    default:
      log.info("No updates available");
      unregisterUpdateStateChangeRegistration();
      break;
  }
}

function applyUpdates(updateState: CMsgSystemUpdateState.AsObject): void {
  var osUpdateAvailable = false;

  if (updateState.supportsOsUpdates) {
    for (var checkResult of updateState.updateCheckResultsList) {
      if (checkResult.available && checkResult.type) {
        switch (checkResult.type) {
          case EUpdaterType.K_EUPDATERTYPE_OS:
          case EUpdaterType.K_EUPDATERTYPE_BIOS:
          case EUpdaterType.K_EUPDATERTYPE_AGGREGATED:
            osUpdateAvailable = true;
            break;
          default:
            break;
        }
      }
    }
  }

  if (osUpdateAvailable) {
    log.info("OS update availbale, applying...");
    SteamClient.Updates.ApplyUpdates("CAI=");
  } else {
    log.info("Client update available, applying...");
    SteamClient.Updates.ApplyUpdates("CAE=");
  }
}

function handleOsUpdateApplication(updateState: CMsgSystemUpdateState.AsObject): void {
  if (!readyForUpdate()) {
    log.info("System not ready for update, skipping...");
    unregisterUpdateStateChangeRegistration();
  } else if ((updateState.progress?.stageProgress) && (updateState.progress?.stageProgress >= 100)) {
    log.info("Pending system restart, restarting...");
    SteamClient.System.RestartPC();
  } else {
    // Update application in progress
  }
}

function readyForUpdate() {
  if (window.NotificationStore.BIsUserInGame()) {
    log.info("User in game");
    return false;
  }
  if ((interop.getBatteryLevel() < interop.getMinBattery()) && (!interop.getIsCharging())) {
    log.warning("Battery level low");
    return false;
  }
  return true;
}

export default definePlugin(() => {
  interop.getCron().then(response => {
    updateSchedule(response, false);
  })

  return {
    name: "Deck Auto Update",
    content: <Content />,
    icon: <FaRegArrowAltCircleUp />,
    onDismount() {
      unregisterUpdateStateChangeRegistration();
      updateSchedule("", false, false);
    },
  };
});
