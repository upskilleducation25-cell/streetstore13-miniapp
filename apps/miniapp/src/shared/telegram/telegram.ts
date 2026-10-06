// Безпечна обгортка над Telegram.WebApp: поза Telegram усі виклики — no-op.
import type { TelegramEvent, TelegramWebApp } from "./types";

/** WebApp, лише якщо застосунок справді відкрито в Telegram (є initData). */
export function getWebApp(): TelegramWebApp | undefined {
  const webApp = typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
  return webApp?.initData ? webApp : undefined;
}

/** Підтримується лише з певної версії Bot API; на старих клієнтах — пропускаємо. */
function supports(webApp: TelegramWebApp, version: string): boolean {
  try {
    return webApp.isVersionAtLeast(version);
  } catch {
    return false;
  }
}

/** Кольори теми → CSS-змінні застосунку (index.css має запасні значення для браузера). */
function applyTheme(webApp: TelegramWebApp): void {
  const root = document.documentElement;
  root.dataset.colorScheme = webApp.colorScheme;
  const bg = webApp.themeParams.bg_color;
  if (bg && supports(webApp, "6.1")) {
    webApp.setHeaderColor(bg);
    webApp.setBackgroundColor(bg);
  }
}

/** ready(), expand(), тема і підписки. Повертає функцію відписки. */
export function initTelegram(): () => void {
  const webApp = getWebApp();
  if (!webApp) return () => {};

  webApp.ready();
  webApp.expand();
  applyTheme(webApp);

  const onTheme = () => applyTheme(webApp);
  const events: TelegramEvent[] = ["themeChanged"];
  for (const event of events) webApp.onEvent(event, onTheme);
  return () => {
    for (const event of events) webApp.offEvent(event, onTheme);
  };
}

export const haptic = {
  success: () => getWebApp()?.HapticFeedback.notificationOccurred("success"),
  error: () => getWebApp()?.HapticFeedback.notificationOccurred("error"),
};
