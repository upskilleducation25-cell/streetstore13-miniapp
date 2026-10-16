import { HttpStatus } from "@nestjs/common";
import { slugify } from "@ss13/shared";

import { AppException } from "../common/app-exception.js";
import { Prisma } from "../generated/prisma/client.js";

/** Помилка поля у тому ж форматі, що й ValidationPipe: форма підсвітить потрібне поле. */
export const fieldError = (field: string, message: string, code = "VALIDATION_ERROR") =>
  new AppException(code, message, HttpStatus.BAD_REQUEST, [{ field, errors: [message] }]);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppException(code, message, HttpStatus.CONFLICT, details);

export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Вільний slug: заданий вручну має бути унікальним (інакше 409), автоматичний отримує
 * суфікс -2, -3… якщо базовий зайнятий.
 */
export async function resolveSlug(options: {
  requested: string | undefined;
  sources: string[];
  fallback: string;
  isTaken: (slug: string) => Promise<boolean>;
}): Promise<string> {
  const { requested, sources, fallback, isTaken } = options;
  if (requested) {
    if (await isTaken(requested)) {
      throw conflict("SLUG_TAKEN", "Такий slug уже використовується", [
        { field: "slug", errors: ["slug зайнятий"] },
      ]);
    }
    return requested;
  }
  const base = sources.map(slugify).find(Boolean) ?? fallback;
  for (let index = 1; index < 1000; index++) {
    const candidate = index === 1 ? base : `${base.slice(0, 110)}-${index}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw conflict("SLUG_TAKEN", "Не вдалося підібрати вільний slug");
}
