// Мінімальні типи Telegram.WebApp — тільки те, що використовує вітрина.
// Довідка: https://core.telegram.org/bots/webapps

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
}

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

export interface TelegramMainButtonParams {
  text?: string;
  color?: string;
  text_color?: string;
  is_active?: boolean;
  is_visible?: boolean;
}

interface TelegramMainButton {
  setParams(params: TelegramMainButtonParams): void;
  show(): void;
  hide(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

interface TelegramHaptics {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

export type TelegramEvent =
  "themeChanged" | "viewportChanged" | "safeAreaChanged" | "contentSafeAreaChanged";

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  BackButton: TelegramBackButton;
  MainButton: TelegramMainButton;
  HapticFeedback: TelegramHaptics;
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  onEvent(event: TelegramEvent, callback: () => void): void;
  offEvent(event: TelegramEvent, callback: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
