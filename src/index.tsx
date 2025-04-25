import { FaRegArrowAltCircleUp } from "react-icons/fa";
import { definePlugin } from "@decky/ui";
import { Unregisterable } from "@decky/ui/dist/globals/steam-client/shared";
import { PLUGIN_NAME } from "./helpers/commonDefs";
import QuickAccessMenu from "./pages/quickAccessMenu";
import UpdateManager from "./helpers/updateManager";

export default definePlugin(() => {
  const registrations: Array<Unregisterable> = []
  registrations.push(UpdateManager.register());

  return {
    name: PLUGIN_NAME,
    content: <QuickAccessMenu />,
    icon: <FaRegArrowAltCircleUp />,
    onDismount() {
      registrations.forEach((registration) => registration.unregister());
    },
  };
});
