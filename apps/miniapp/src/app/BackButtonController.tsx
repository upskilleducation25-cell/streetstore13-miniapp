import { useEffect } from "react";
import { useLocation } from "react-router";

import { getWebApp } from "../shared/telegram/telegram";
import { useGoBack } from "./navigation";

/** Синхронізує BackButton Telegram з роутером: на головній прихована. */
export function BackButtonController() {
  const { pathname } = useLocation();
  const goBack = useGoBack();

  useEffect(() => {
    const backButton = getWebApp()?.BackButton;
    if (!backButton) return;
    if (pathname === "/") {
      backButton.hide();
      return;
    }
    backButton.onClick(goBack);
    backButton.show();
    return () => backButton.offClick(goBack);
  }, [pathname, goBack]);

  return null;
}
