import { useEffect, useState } from "react";
import { ButtonItem, PanelSection, PanelSectionRow, SliderField } from "@decky/ui";
import { textInputPopup } from "../components/popups";
import Config from "../helpers/config";

export default function quickAccessMenu() {
  const [cron] = useState(Config.get("cron"));
  const [minBattery] = useState(Config.get("min_battery"));

  // useEffect(() => {
  //   const registrations: Array<Unregisterable> = []

  //   registrations.push(Config.on("cron", setCron));
  //   registrations.push(Config.on("min_battery", setMinBattery));

  //   return () => {
  //     registrations.forEach((registration) => registration.unregister());
  //   };
  // }, []);

  return (
    <>
      <PanelSection>
        <PanelSectionRow>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ButtonItem
              bottomSeparator="none"
              onClick={() =>
                textInputPopup(
                  "Update Schedule",
                  "Enter the cron expression, put anything invalid or leave it empty to disable",
                  (cronText) => Config.set("cron", cronText)
                )}>
              {cron ? cron : "Add"}
            </ButtonItem>
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <SliderField
            bottomSeparator="none"
            label={"Min Update Battery"}
            min={20}
            max={100}
            value={Math.max(minBattery, 0)}
            valueSuffix={"%"}
            showValue={true}
            // onChange={async (value) => {
            //   setMinBattery(value);
            //   await backend.setMinBattery(value);
            // }}
            onChange={(value: number) => {
              Config.set("min_battery", value);
            }}
            step={5}
            notchTicksVisible={false}
          />
        </PanelSectionRow>
      </PanelSection>
    </>
  );
};
