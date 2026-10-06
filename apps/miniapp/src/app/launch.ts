import { createContext, useContext } from "react";

import type { LaunchMode } from "../shared/telegram/launch-mode";

export const LaunchModeContext = createContext<LaunchMode>("browser");
export const useLaunchMode = () => useContext(LaunchModeContext);
