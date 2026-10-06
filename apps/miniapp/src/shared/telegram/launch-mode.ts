// Як запущено застосунок. Чиста функція без import.meta.env, щоб її можна було тестувати.

export type LaunchMode =
  /** Відкрито в Telegram: є підписаний initData. */
  | "telegram"
  /** Dev-збірка поза Telegram: підставляється тестовий користувач. */
  | "dev-mock"
  /** Production поза Telegram: каталог доступний, вхід вимкнено, моку немає. */
  | "browser";

export function resolveLaunchMode(options: {
  isDev: boolean;
  initData: string | undefined | null;
}): LaunchMode {
  if (options.initData) return "telegram";
  return options.isDev ? "dev-mock" : "browser";
}

/** Чи може застосунок увійти (отримати initData) у цьому режимі. */
export const canLogin = (mode: LaunchMode): boolean => mode !== "browser";
