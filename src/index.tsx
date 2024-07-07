/// <reference types="../typings/index.d.ts"/>

import {
  definePlugin,
  showModal,
  staticClasses,
  ButtonItem,
  ConfirmModal,
  PanelSection,
  PanelSectionRow,
  ServerAPI,
  SliderField,
  TextField,
} from "decky-frontend-lib";
import { PyInterop } from "./PyInterop";
import { useEffect, useRef, useState, VFC } from "react";
import { FaRegArrowAltCircleUp } from "react-icons/fa";
import { CMsgSystemUpdateState } from "../protobuf/build/steammessages_client_objects_pb";
import { EUpdaterState } from "../protobuf/build/enums_pb";
import { Cron } from "croner";

declare global {
  interface Window {
    NotificationStore: any;
  }
}

// Global variables
var schedule: any = null;
var updateTimeout: any = null;
var updateStateChangeRegistration: any = null;

const Content: VFC<{ serverAPI: ServerAPI }> = ({ }) => {
  const initializaing = useRef(true);

  var cronText = "";
  const [cronText_Display, setCronText_Display] = useState(cronText);
  const [minBattery_Display, setMinBattery_Display] = useState(-1);

  useEffect(() => {
    if (initializaing.current) {
      initializaing.current = false;
      PyInterop.getCron().then(response => {
        setCronText_Display(response);
      })
      PyInterop.getMinBattery().then(response => {
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
              await PyInterop.setMinBattery(value);
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
    PyInterop.setCron(cronExpression);
  }

  schedule?.stop();
  schedule = null;
  try {
    schedule = Cron(cronExpression, checkForUpdates);
    PyInterop.logInfo("Cron schedule set to: " + cronExpression);
  } catch (e) {
    if (logError) {
      PyInterop.logError("Failed to parse cron expression: " + e);
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
    PyInterop.logInfo("An update is in progress, skipping...");
    return;
  } else if ((PyInterop.getBatteryLevel() < PyInterop.getMinBattery()) && (!PyInterop.getIsCharging())) {
    PyInterop.logInfo("Battery low, skipping...");
    return;
  } else if (window.NotificationStore.BIsUserInGame()) {
    PyInterop.logInfo("In game, skipping...");
    return;
  }

  PyInterop.logInfo("Checking for updates...");
  updateStateChangeRegistration = SteamClient.Updates.RegisterForUpdateStateChanges(updateStateChangeHandler);
  // 1 hour timeout for updating, terminate gracefully if it exceeds that time
  updateTimeout = setTimeout(unregisterUpdateStateChangeRegistration, 60 * 60 * 1000);
  SteamClient.Updates.CheckForUpdates().catch((e: any) => {
    PyInterop.logError("Failed to check for updates: " + e);
    unregisterUpdateStateChangeRegistration();
  })
};

function updateStateChangeHandler(protoMsg: Uint8Array): void {
  try {
    var updateState = CMsgSystemUpdateState.deserializeBinary(protoMsg).toObject();
  } catch (e) {
    PyInterop.logError("Failed to parse update state: " + e);
    unregisterUpdateStateChangeRegistration();
    return;
  }

  switch (updateState.state) {
    case EUpdaterState.K_EUPDATERSTATE_AVAILABLE:
      PyInterop.logInfo("Updates available, applying...");
      // "CAI=" comes from the debugger, not sure what it means but works...
      SteamClient.Updates.ApplyUpdates("CAI=");
      break;
    case EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING:
      if (updateState.supportsOsUpdates) {
        if (window.NotificationStore.BIsUserInGame()) {
          PyInterop.logWarning("In game, skip restarting...");
        } else {
          PyInterop.logInfo("Pending system restart, restarting...");
          SteamClient.System.RestartPC();
        }
      } else {
        PyInterop.logWarning("Invalid state, system restart available but OS updates are unsupported...");
      }
      // If we didn't restart, unregister the handler
      unregisterUpdateStateChangeRegistration();
      break;
    case EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING:
      if (window.NotificationStore.BIsUserInGame()) {
        PyInterop.logWarning("In game, skip restarting...");
      } else {
        PyInterop.logInfo("Pending client restart, restarting...");
        SteamClient.User.StartRestart();
      }
      // If we didn't restart, unregister the handler
      unregisterUpdateStateChangeRegistration();
      break;
    case EUpdaterState.K_EUPDATERSTATE_CHECKING:
    case EUpdaterState.K_EUPDATERSTATE_APPLYING:
      break;
    default:
      PyInterop.logInfo("No updates available");
      unregisterUpdateStateChangeRegistration();
      break;
  }
}

export default definePlugin((serverApi: ServerAPI) => {
  PyInterop.setServer(serverApi);
  PyInterop.getCron().then(response => {
    updateSchedule(response, false);
  })

  return {
    title: <div className={staticClasses.Title}>Deck Auto Update</div>,
    content: <Content serverAPI={serverApi} />,
    icon: <FaRegArrowAltCircleUp />,
    onDismount() {
      unregisterUpdateStateChangeRegistration();
      updateSchedule("", false, false);
    },
  };
});
