import { useEffect, useRef } from "react";

import { Button } from "../ui/States";
import { getWebApp } from "./telegram";

/**
 * Головна дія екрана. У Telegram — системна MainButton (без дубля в HTML);
 * поза Telegram (dev, браузер) — закріплена кнопка внизу екрана.
 */
export function MainButton({
  text,
  disabled = false,
  onClick,
}: {
  text: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const webApp = getWebApp();
  const handler = useRef(onClick);
  useEffect(() => {
    handler.current = onClick;
  });

  useEffect(() => {
    if (!webApp) return;
    const listener = () => handler.current();
    webApp.MainButton.onClick(listener);
    webApp.MainButton.show();
    return () => {
      webApp.MainButton.offClick(listener);
      webApp.MainButton.hide();
    };
  }, [webApp]);

  useEffect(() => {
    webApp?.MainButton.setParams({ text, is_active: !disabled, is_visible: true });
  }, [webApp, text, disabled]);

  if (webApp) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg px-4 pt-3 pb-[calc(12px+var(--safe-bottom))]">
      <Button className="w-full" disabled={disabled} onClick={onClick}>
        {text}
      </Button>
    </div>
  );
}
