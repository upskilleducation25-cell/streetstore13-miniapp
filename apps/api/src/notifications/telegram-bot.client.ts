// Мінімальний клієнт Telegram Bot API для надсилання повідомлень.
// Токен бота входить в URL запиту, тому він ніколи не потрапляє в помилки й логи:
// усі тексти помилок проходять через redact().

export type TelegramErrorKind =
  /** 403: покупець заблокував бота або ще не запускав його. */
  | "FORBIDDEN"
  /** 400: чат не знайдено, некоректні параметри. */
  | "BAD_REQUEST"
  /** 401/404: недійсний токен бота. */
  | "UNAUTHORIZED"
  /** 429 після всіх повторів. */
  | "RATE_LIMITED"
  /** 5xx після всіх повторів. */
  | "SERVER"
  /** Мережа або тайм-аут після всіх повторів. */
  | "NETWORK";

export class TelegramSendError extends Error {
  constructor(
    readonly kind: TelegramErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TelegramSendError";
  }
}

export interface InlineWebAppButton {
  text: string;
  web_app: { url: string };
}

export interface SendMessageOptions {
  /** Кнопки під повідомленням (тільки web_app, тільки в особистому чаті). */
  buttons?: InlineWebAppButton[];
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

/** Межа довжини повідомлення в Telegram. */
export const TELEGRAM_MESSAGE_LIMIT = 4096;

export function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join("***") : text;
}

export function truncateMessage(text: string, limit = TELEGRAM_MESSAGE_LIMIT): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

const RETRYABLE: ReadonlySet<TelegramErrorKind> = new Set(["RATE_LIMITED", "SERVER", "NETWORK"]);

export class TelegramBotClient {
  private readonly fetch: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  /** Довше чекати на 429 не будемо: сповіщення не повинні висіти хвилинами. */
  private readonly maxRetryAfterMs: number;

  constructor(
    private readonly options: {
      token: string;
      baseUrl: string;
      fetch?: typeof fetch;
      sleep?: (ms: number) => Promise<void>;
      timeoutMs?: number;
      maxAttempts?: number;
      maxRetryAfterMs?: number;
    },
  ) {
    this.fetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.maxRetryAfterMs = options.maxRetryAfterMs ?? 5_000;
  }

  async sendMessage(
    chatId: string | number | bigint,
    text: string,
    options: SendMessageOptions = {},
  ): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: typeof chatId === "bigint" ? chatId.toString() : chatId,
      text: truncateMessage(text),
      link_preview_options: { is_disabled: true },
    };
    if (options.buttons?.length) {
      body.reply_markup = { inline_keyboard: options.buttons.map((button) => [button]) };
    }

    for (let attempt = 1; ; attempt++) {
      const result = await this.attempt(body);
      if (result.ok) return;
      const { error, retryAfterMs } = result;
      const canRetry =
        attempt < this.maxAttempts &&
        RETRYABLE.has(error.kind) &&
        (retryAfterMs === undefined || retryAfterMs <= this.maxRetryAfterMs);
      if (!canRetry) throw error;
      await this.sleep(retryAfterMs ?? 500 * 2 ** (attempt - 1));
    }
  }

  private async attempt(
    body: Record<string, unknown>,
  ): Promise<{ ok: true } | { ok: false; error: TelegramSendError; retryAfterMs?: number }> {
    const { token, baseUrl } = this.options;
    const url = `${baseUrl.replace(/\/$/, "")}/bot${token}/sendMessage`;
    let response: Response;
    try {
      response = await this.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
      return {
        ok: false,
        error: new TelegramSendError("NETWORK", redact(`Мережева помилка (${reason})`, token)),
      };
    }

    let payload: TelegramResponse | undefined;
    try {
      payload = (await response.json()) as TelegramResponse;
    } catch {
      payload = undefined;
    }
    if (response.ok && payload?.ok) return { ok: true };

    const status = response.status;
    const description = redact(payload?.description ?? `HTTP ${status}`, token);
    const kind: TelegramErrorKind =
      status === 403
        ? "FORBIDDEN"
        : status === 429
          ? "RATE_LIMITED"
          : status === 401 || status === 404
            ? "UNAUTHORIZED"
            : status >= 500
              ? "SERVER"
              : "BAD_REQUEST";
    const retryAfter = payload?.parameters?.retry_after;
    return {
      ok: false,
      error: new TelegramSendError(kind, description, status),
      retryAfterMs: kind === "RATE_LIMITED" && retryAfter ? retryAfter * 1000 : undefined,
    };
  }
}
