// ТІЛЬКИ ДЛЯ DEV. Імпортується динамічно під `if (import.meta.env.DEV)`, тож у
// production-збірку не потрапляє (це перевіряє тест build-output.test.ts).
//
// initData для тестового користувача підписує dev-сервер Vite (vite.config.ts) токеном
// з локального apps/api/.env. Сам токен у браузер не передається.

export const DEV_INIT_DATA_ENDPOINT = "/__ss13_dev/telegram-init-data";

export async function loadDevInitData(): Promise<string | null> {
  try {
    const response = await fetch(DEV_INIT_DATA_ENDPOINT);
    if (!response.ok) {
      console.warn(
        "[dev] Тестовий initData недоступний: задайте TELEGRAM_BOT_TOKEN у apps/api/.env. Вітрина працює без входу.",
      );
      return null;
    }
    const body = (await response.json()) as { initData: string };
    return body.initData;
  } catch {
    return null;
  }
}
