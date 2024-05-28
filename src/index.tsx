/// <reference types="../typings/index.d.ts"/>

import {
    definePlugin,
    showModal,
    staticClasses,
    ButtonItem,
    ConfirmModal,
    ServerAPI,
    TextField,
} from "decky-frontend-lib";
import { PyInterop } from "./PyInterop";
import { useEffect, useState, VFC } from "react";
import { FaRegArrowAltCircleUp } from "react-icons/fa";
import { CMsgSystemUpdateState } from "../protobuf/build/steammessages_client_objects_pb";
import { EUpdaterState } from "../protobuf/build/enums_pb";
import { Cron } from "croner";

// Global variables
var schedule: any = null;
var updateTimeout: any = null;
var updateStateChangeRegistration: any = null;

const Content: VFC<{ serverAPI: ServerAPI }> = ({ }) => {
    const [cronText, setCronText] = useState("Add");
    var inputText = "";

    useEffect(() => {
        setCronText(schedule?.getPattern());
    });

    return (
        <div style={{ display: "flex", justifyContent: "center" }}>
        <ButtonItem
            bottomSeparator="none"
            onClick={() => {
                showModal(
                    <ConfirmModal
                        strTitle="Update Schedule"
                        strDescription="Enter the cron expression, put anything invalid or leave it empty to disable"
                        onOK={() => updateSchedule(inputText)}>
                        <TextField
                            defaultValue={cronText}
                            onChange={(e) => inputText = e.target.value}
                            onBlur={(e) => inputText = e.target.value} />
                    </ConfirmModal>
                );
            }}>
            {cronText}
        </ButtonItem>
        </div>
    );
};

function updateSchedule(cronExpression: string, updateSettings: boolean = true): void {
    if (updateSettings) {
        PyInterop.setCron(cronExpression);
    }

    schedule?.stop();
    schedule = null;
    try {
        schedule = Cron(cronExpression, checkForUpdates);
    } catch (e) {
        PyInterop.logError("Received invalid cron expression: " + e);
    }
}

function unregisterUpdateStateChangeRegistration(): void {
    clearTimeout(updateTimeout);
    updateTimeout = null;
    updateStateChangeRegistration?.unregister();
    updateStateChangeRegistration = null;
}

function checkForUpdates(): void {
    if (updateStateChangeRegistration) {
        PyInterop.logInfo("An update is in progress, skipping...");
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
                PyInterop.logInfo("Pending system restart, restarting...");
                SteamClient.System.RestartPC();
            } else {
                PyInterop.logWarning("Invalid state, system restart available but OS updates are unsupported...");
                unregisterUpdateStateChangeRegistration();
            }
            break;
        case EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING:
            PyInterop.logInfo("Pending client restart, restarting...");
            SteamClient.User.StartRestart();
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
        updateSchedule(response.result, false);
    })

    return {
        title: <div className={staticClasses.Title}>Auto Update</div>,
        content: <Content serverAPI={serverApi} />,
        icon: <FaRegArrowAltCircleUp />,
        onDismount() {
            unregisterUpdateStateChangeRegistration();
            schedule?.stop();
        },
    };
});
