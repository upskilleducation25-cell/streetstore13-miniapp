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
