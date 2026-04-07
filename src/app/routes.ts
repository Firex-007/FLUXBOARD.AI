import { createMemoryRouter } from "react-router";
import PrompterCAD from "./components/PrompterCAD";
import LandingPage from "./pages/LandingPage";

export const router = createMemoryRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/app",
    Component: PrompterCAD,
  }
]);
