import type { ApiErrorBody } from "@ss13/shared";

/** Будь-яка помилка API в єдиному форматі {code, message, details?} + HTTP-статус. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiErrorBody).code === "string" &&
    typeof (value as ApiErrorBody).message === "string"
  );
}

/** Перетворює відповідь з помилкою на ApiError; тіло не у форматі API — теж обробляється. */
export function toApiError(status: number, body: unknown): ApiError {
  if (isApiErrorBody(body)) return new ApiError(status, body.code, body.message, body.details);
  return new ApiError(status, `HTTP_${status}`, `HTTP ${status}`);
}

export const networkError = () => new ApiError(0, "NETWORK_ERROR", "Немає з'єднання з сервером");

export type ErrorKind = "network" | "server" | "notFound" | "client";

/** Як показати помилку користувачу: текст не залежить від технічних деталей. */
export function errorKind(error: unknown): ErrorKind {
  if (!(error instanceof ApiError)) return "server";
  if (error.isNetwork) return "network";
  if (error.status === 404) return "notFound";
  if (error.status >= 500) return "server";
  return "client";
}
