import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().optional(),
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
});

export type Env = z.infer<typeof envSchema>;

/** Перевіряє змінні оточення при старті; падає з зрозумілою помилкою, якщо чогось бракує. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Некоректні змінні оточення:\n${issues}`);
  }
  return result.data;
}
