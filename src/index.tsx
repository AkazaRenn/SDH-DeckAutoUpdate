/// <reference types="../typings/index.d.ts"/>

import {
    definePlugin,
    PanelSection,
    PanelSectionRow,
    Router,
    ServerAPI,
    staticClasses,
    ToggleField,
    ButtonItem,
    Spinner,
} from "decky-frontend-lib";
import { PyInterop } from "./PyInterop";
import { useEffect, useState, VFC } from "react";
import { FaBuffer } from "react-icons/fa";
import { FlatpakInfo } from "./FlatpakInfo";
import { CMsgSystemUpdateState } from "../protobuf/build/steammessages_client_objects_pb";
import { EUpdaterState } from "../protobuf/build/enums_pb";
import { Cron } from "croner";

type FlatpaksDictionary = {
    [key: string]: FlatpakInfo
}

enum UpdateCheckerState {
    IDLE = 0,
    CHECKING,
}

// Global variables
var schedule: any = null;
var updateTimeout: any = null;
var updateStateChangeRegistration: any = null;

var paksToUpdate: FlatpaksDictionary = {};

const Content: VFC<{ serverAPI: ServerAPI }> = ({ }) => {
    const [flatPaks, setUpdatableFlatpaks] = useState<FlatpaksDictionary>({});
    const [_, reloadGUI] = useState<any>("");
    const [updaterState, setUpdaterState] = useState<UpdateCheckerState>(UpdateCheckerState.IDLE);
    if (Object.values(flatPaks).length == 0) {
        paksToUpdate = {};
    }

    if (updaterState == UpdateCheckerState.CHECKING) {
        async () => {
            PyInterop.getUpdatableFlatpaks()
                .then(data => {
                    if (data.success) {
                        setUpdatableFlatpaks(data.result);
                    }
                });
        }
    }

    useEffect(() => {
        if (updaterState == UpdateCheckerState.CHECKING) {
            PyInterop.getUpdatableFlatpaks()
                .then(data => {
                    if (data.success) {
                        setUpdatableFlatpaks(data.result);
                    }
                });
        }
    }, [])

    return (
        <PanelSection title="Flatpaks">
            <PanelSectionRow>
                <div style={{ display: "flex", justifyContent: "center" }}>
                    <ButtonItem bottomSeparator="none" onClick={() => {
                        setUpdatableFlatpaks({});
                        setUpdaterState(UpdateCheckerState.CHECKING);
                        PyInterop.getUpdatableFlatpaks()
                            .then(data => {
                                if (data.success) {
                                    setUpdaterState(UpdateCheckerState.IDLE);
                                    setUpdatableFlatpaks(data.result);
                                }
                            });
                    }} disabled={updaterState != UpdateCheckerState.IDLE}>
                        {updaterState == UpdateCheckerState.IDLE &&
                            "Check for updates"
                        }
                        {updaterState == UpdateCheckerState.CHECKING &&
                            "Checking for updates"
                        }
                    </ButtonItem>
                </div>
            </PanelSectionRow>

            <PanelSectionRow>
                <div style={{ display: "flex", justifyContent: "center" }}>
                    {Object.values(flatPaks).length > 0 &&
                        <div>
                            <b>{Object.values(flatPaks).length}</b> updates available
                        </div>
                    }
                    {updaterState == UpdateCheckerState.CHECKING &&
                        <div>
                            <Spinner width="96px" height="96px" />
                        </div>
                    }
                </div>
            </PanelSectionRow>

            <PanelSectionRow>
                <div>
                    {
                        Object.values(flatPaks).map((info) => (
                            <div style={{ display: "block", justifyContent: "stretch" }}>
                                <ToggleField
                                    checked={paksToUpdate[info.appID] !== undefined}
                                    label={info.name}
                                    onChange={(checked: boolean) => {
                                        if (checked) {
                                            paksToUpdate[info.appID] = info;
                                            console.info('added ' + info.appID)
                                            reloadGUI("Added package to update " + info.name)
                                        } else {
                                            delete paksToUpdate[info.appID];
                                            console.info('removed ' + info.appID)
                                            reloadGUI("Removed package to update " + info.name)
                                        }
                                    }} />
                            </div>
                        ))
                    }
                </div>
            </PanelSectionRow>

            {Object.values(flatPaks).length > 0 &&
                <PanelSectionRow>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                        <ButtonItem bottomSeparator="none" onClick={() => {
                            setUpdatableFlatpaks({});
                            Router.CloseSideMenus();
                            Router.Navigate("/apply-updates");
                        }} disabled={Object.values(paksToUpdate).length == 0}>Update selected</ButtonItem>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                        <ButtonItem bottomSeparator="none" onClick={() => {
                            paksToUpdate = flatPaks;
                            setUpdatableFlatpaks({});
                            Router.CloseSideMenus();
                            Router.Navigate("/apply-updates");
                        }}>Update all</ButtonItem>
                    </div>
                </PanelSectionRow>
            }
        </PanelSection>
    );
};

function unregisterUpdateStateChangeRegistration(): void {
    clearTimeout(updateTimeout);
    updateTimeout = null;
    updateStateChangeRegistration?.unregister();
    updateStateChangeRegistration = null;
}

function checkForUpdates(): void {
    if (updateStateChangeRegistration) {
        console.log("An update is in progress, skipping...");
        return;
    }

    console.log("Checking for updates...");
    updateStateChangeRegistration = SteamClient.Updates.RegisterForUpdateStateChanges(updateStateChangeHandler);
    // 1 hour timeout for updating, terminate gracefully if it exceeds that time
    updateTimeout = setTimeout(unregisterUpdateStateChangeRegistration, 60 * 60 * 1000);
    SteamClient.Updates.CheckForUpdates().catch((e: any) => {
        console.log("Failed to check for updates: " + e);
        unregisterUpdateStateChangeRegistration();
    })
};

function updateStateChangeHandler(protoMsg: Uint8Array): void {
    try {
        var updateState = CMsgSystemUpdateState.deserializeBinary(protoMsg).toObject();
    } catch (e) {
        console.log("Failed to parse update state: " + e);
        unregisterUpdateStateChangeRegistration();
        return;
    }

    switch (updateState.state) {
        case EUpdaterState.K_EUPDATERSTATE_AVAILABLE:
            console.log("Updates available, applying...");
            // "CAI=" comes from the debugger, not sure what it means but works...
            SteamClient.Updates.ApplyUpdates("CAI=");
            break;
        case EUpdaterState.K_EUPDATERSTATE_SYSTEMRESTARTPENDING:
            if (updateState.supportsOsUpdates) {
                console.log("Pending system restart, restarting...");
                SteamClient.System.RestartPC();
            } else {
                console.log("Invalid state, system restart available but OS updates are unsupported...");
                unregisterUpdateStateChangeRegistration();
            }
            break;
        case EUpdaterState.K_EUPDATERSTATE_CLIENTRESTARTPENDING:
            console.log("Pending client restart, restarting...");
            SteamClient.User.StartRestart();
            break;
        case EUpdaterState.K_EUPDATERSTATE_CHECKING:
        case EUpdaterState.K_EUPDATERSTATE_APPLYING:
            break;
        default:
            console.log("No updates available");
            unregisterUpdateStateChangeRegistration();
            break;
    }
}

function reschedule(cronExpression: string): void {
    schedule?.stop();
    schedule = Cron(cronExpression, checkForUpdates);
}

export default definePlugin((serverApi: ServerAPI) => {
    PyInterop.setServer(serverApi);
    reschedule("0 4 * * *");

    return {
        title: <div className={staticClasses.Title}>Auto Update</div>,
        content: <Content serverAPI={serverApi} />,
        icon: <FaBuffer />,
        onDismount() {
            unregisterUpdateStateChangeRegistration();
            schedule?.stop();
        },
    };
});
