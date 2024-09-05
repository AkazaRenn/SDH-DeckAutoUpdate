import {
  beforePatch,
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
import { CMsgSystemUpdateState } from "../deps/protobuf/out/steammessages_client_objects_pb";
import { EUpdaterState } from "../deps/protobuf/out/enums_pb";

// Global variables
var updateTimeout: any = null;
var updateStateChangeRegistration: any = null;

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

function unregisterUpdateStateChangeRegistration(): void {
  clearTimeout(updateTimeout);
  updateTimeout = null;
  updateStateChangeRegistration?.unregister();
  updateStateChangeRegistration = null;
}

function updateStateChangeHandler(protoMsg: Uint8Array): void {
  try {
    var updateState = CMsgSystemUpdateState.deserializeBinary(protoMsg).toObject();
  } catch (e) {
    log.error("Failed to parse update state: " + e);
    return;
  }

  log.info("Update state value: " + updateState.state);
  if (updateState.state) {
    log.info("    State: " + EUpdaterStateToString(updateState.state));
  }
  console.log(updateState);
}

function EUpdaterStateToString(state: EUpdaterState): string {
  switch (state) {
    case EUpdaterState.K_EUPDATERSTATE_INVALID: return "K_EUPDATERSTATE_INVALID";
    case EUpdaterState.K_EUPDATERSTATE_UPTODATE: return "K_EUPDATERSTATE_UPTODATE";
    case EUpdaterState.K_EUPDATERSTATE_CHECKING: return "K_EUPDATERSTATE_CHECKING";
    case EUpdaterState.K_EUPDATERSTATE_AVAILABLE: return "K_EUPDATERSTATE_AVAILABLE";
    case EUpdaterState.K_EUPDATERSTATE_APPLYING: return "K_EUPDATERSTATE_APPLYING";
    case EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING: return "K_EUPDATERSTATE_CLIENTRESTARTPENDING";
    case EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING: return "K_EUPDATERSTATE_SYSTEMRESTARTPENDING";
    case EUpdaterState.K_EUPDATERSTATE_ROLLBACK: return "K_EUPDATERSTATE_ROLLBACK";
    default: return "UNKNOWN";
  }
}

// Entry point

export default definePlugin(() => {
  updateStateChangeRegistration = SteamClient.Updates.RegisterForUpdateStateChanges(updateStateChangeHandler);
  let patch = beforePatch(SteamClient.Updates, "ApplyUpdates", (inputs: any[]) => {
    log.info("Updates params:", inputs);
  });

  return {
    name: "Deck Auto Update",
    content: <Content />,
    icon: <FaRegArrowAltCircleUp />,
    onDismount() {
      unregisterUpdateStateChangeRegistration();
      patch.unpatch();
    },
  };
});
