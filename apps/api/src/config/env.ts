import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().optional(),
  /** Приватна URL-адреса EasyDrop XML-фіду. Не логувати: може містити ключ доступу. */
  EASYDROP_FEED_URL: z.string().optional().transform((value) => value?.trim() || undefined),
  /** Токен бота від @BotFather. Без нього вхід через Telegram повертає 503. */
  TELEGRAM_BOT_TOKEN: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  /**
   * Чат власника / менеджерів для сповіщень про нові замовлення: числовий ID чату або
   * @username каналу. Якщо не задано — береться settings.notifications.adminChatId з БД.
   */
  TELEGRAM_ADMIN_CHAT_ID: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => value === undefined || /^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/.test(value), {
      message: "TELEGRAM_ADMIN_CHAT_ID: числовий ID чату або @username каналу",
    }),
  /** Адреса Bot API. Змінюється тільки в тестах (фейковий сервер) або для локального Bot API. */
  TELEGRAM_API_BASE_URL: z.url().default("https://api.telegram.org"),
  /** Публічна HTTPS-адреса Mini App: для кнопки «Відкрити замовлення» в повідомленні бота. */
  MINIAPP_URL: z
    .string()
    .optional()
    .transform((value) => value?.trim().replace(/\/$/, "") || undefined)
    .refine((value) => value === undefined || value.startsWith("https://"), {
      message: "MINIAPP_URL має починатися з https://",
    }),
  /** Скільки секунд initData вважається свіжим (auth_date). За замовчуванням 24 години. */
  TELEGRAM_INIT_DATA_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  /** Секрет підпису JWT покупця, мінімум 32 символи. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET має містити щонайменше 32 символи"),
  /** Час життя JWT покупця в секундах. За замовчуванням 7 днів. */
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(604_800),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  /**
   * Express "trust proxy": за реверс-проксі (Railway, nginx) задайте кількість проксі, напр. 1,
   * щоб ліміт входу рахував реальний IP клієнта. Порожньо — X-Forwarded-For ігнорується.
   */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => value === undefined || /^(\d{1,2}|loopback|true|false)$/.test(value), {
      message: "TRUST_PROXY: число проксі (1), loopback, true або false",
    }),

  // ─── Адмінка ───
  /** Скільки годин живе сесія адміна. За замовчуванням 12. */
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  /** Cookie сесії тільки через HTTPS. За замовчуванням увімкнено в production. */
  ADMIN_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  /**
   * SameSite cookie сесії. strict — адмінка і API на одному домені (admin.x.ua + api.x.ua);
   * none — різні сайти (потрібен ADMIN_COOKIE_SECURE=true). CSRF-токен перевіряється завжди.
   */
  ADMIN_COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("strict"),

  // ─── Сховище фото ───
  /**
   * r2 — Cloudflare R2 (S3 API); local — файли на диску API (тільки розробка і тести);
   * none — завантаження вимкнено (503). За замовчуванням: local поза production, інакше none.
   */
  STORAGE_DRIVER: z.enum(["r2", "local", "none"]).optional(),
  /** Тека для local-драйвера; файли віддаються API за /api/v1/uploads/… */
  LOCAL_STORAGE_DIR: z.string().default("uploads"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  /** Публічна адреса бакета (власний домен або r2.dev), без / в кінці. */
  R2_PUBLIC_URL: z
    .string()
    .optional()
    .transform((value) => value?.trim().replace(/\/$/, "") || undefined),
  /** Інший S3-endpoint замість https://<account>.r2.cloudflarestorage.com (тести, MinIO). */
  R2_ENDPOINT: z.url().optional(),
});

type ParsedEnv = z.infer<typeof envSchema>;

export type StorageDriver = "r2" | "local" | "none";

export type Env = Omit<ParsedEnv, "ADMIN_COOKIE_SECURE" | "STORAGE_DRIVER"> & {
  ADMIN_COOKIE_SECURE: boolean;
  STORAGE_DRIVER: StorageDriver;
};

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

function resolve(parsed: ParsedEnv): { env?: Env; issues: string[] } {
  const production = parsed.NODE_ENV === "production";
  const issues: string[] = [];

  const secure =
    parsed.ADMIN_COOKIE_SECURE === undefined ? production : parsed.ADMIN_COOKIE_SECURE === "true";
  if (parsed.ADMIN_COOKIE_SAMESITE === "none" && !secure) {
    issues.push("  ADMIN_COOKIE_SAMESITE: none потребує ADMIN_COOKIE_SECURE=true");
  }

  const driver = parsed.STORAGE_DRIVER ?? (production ? "none" : "local");
  if (driver === "local" && production) {
    issues.push("  STORAGE_DRIVER: local не можна в production — використайте r2");
  }
  if (driver === "r2") {
    for (const key of R2_KEYS) {
      if (key === "R2_ACCOUNT_ID" && parsed.R2_ENDPOINT) continue;
      if (!parsed[key]) issues.push(`  ${key}: обов'язковий для STORAGE_DRIVER=r2`);
    }
    if (parsed.R2_PUBLIC_URL && !/^https?:\/\//.test(parsed.R2_PUBLIC_URL)) {
      issues.push("  R2_PUBLIC_URL: має починатися з https://");
    }
  }

  if (issues.length > 0) return { issues };
  return {
    issues,
    env: { ...parsed, ADMIN_COOKIE_SECURE: secure, STORAGE_DRIVER: driver },
  };
}

/** Перевіряє змінні оточення при старті; падає з зрозумілою помилкою, якщо чогось бракує. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Некоректні змінні оточення:\n${issues}`);
  }
  const resolved = resolve(result.data);
  if (!resolved.env) {
    throw new Error(`Некоректні змінні оточення:\n${resolved.issues.join("\n")}`);
  }
  return resolved.env;
}
