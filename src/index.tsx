import { FaRegArrowAltCircleUp } from "react-icons/fa";
import { definePlugin } from "@decky/ui";
import QuickAccessMenu from "./pages/quickAccessMenu";

export default definePlugin(() => {
  // const registrations: Array<Unregisterable> = [];

  // registrations.push()

  return {
    name: "Deck Auto Update",
    content: <QuickAccessMenu />,
    icon: <FaRegArrowAltCircleUp />,
    onDismount() {
      unregisterUpdateStateChangeRegistration();
      updateSchedule("", false, false);
    },
  };
});
