import { useEffect, useRef } from "react";

import { t } from "../strings";
import { Button } from "../ui/States";
import { getWebApp } from "./telegram";

/**
 * Головна дія екрана. У Telegram — системна MainButton (без дубля в HTML);
 * поза Telegram (dev, браузер) — закріплена кнопка внизу екрана.
 */
export function MainButton({
  text,
  disabled = false,
  progress = false,
  aboveNav = false,
  onClick,
}: {
  text: string;
  disabled?: boolean;
  /** Запит виконується: індикатор на кнопці, повторні натискання ігноруються. */
  progress?: boolean;
  /** Поза Telegram: сторінка з нижньою навігацією, кнопка стоїть над нею. */
  aboveNav?: boolean;
  onClick: () => void;
}) {
  const webApp = getWebApp();
  const handler = useRef(onClick);
  const busy = useRef(progress);
  useEffect(() => {
    handler.current = onClick;
    busy.current = progress;
  });

  useEffect(() => {
    if (!webApp) return;
    const listener = () => {
      if (!busy.current) handler.current();
    };
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

  useEffect(() => {
    if (!webApp) return;
    if (progress) webApp.MainButton.showProgress(false);
    else webApp.MainButton.hideProgress();
  }, [webApp, progress]);

  if (webApp) return null;
  return (
    <div
      className={`fixed inset-x-0 z-30 border-t border-line bg-bg px-4 pt-3 ${
        aboveNav
          ? "bottom-[calc(var(--nav-height)+var(--safe-bottom))] pb-3"
          : "bottom-0 pb-[calc(12px+var(--safe-bottom))]"
      }`}
    >
      <Button
        className="w-full"
        disabled={disabled || progress}
        aria-busy={progress}
        onClick={onClick}
      >
        {progress ? t.common.loading : text}
      </Button>
    </div>
  );
}
