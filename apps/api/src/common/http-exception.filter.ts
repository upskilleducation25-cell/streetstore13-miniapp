import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ApiErrorBody } from "@ss13/shared";
import type { Response } from "express";

const CODE_BY_STATUS: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "TOO_MANY_REQUESTS",
  503: "SERVICE_UNAVAILABLE",
};

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiErrorBody).code === "string" &&
    typeof (value as ApiErrorBody).message === "string"
  );
}

/**
 * Усі помилки віддаються у форматі { code, message, details? }.
 * Невідомі помилки — 500 без стек-трейсу і SQL у відповіді.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const body: ApiErrorBody = isApiErrorBody(raw)
        ? raw
        : {
            code: CODE_BY_STATUS[status] ?? "ERROR",
            message:
              typeof raw === "string"
                ? raw
                : typeof (raw as { message?: unknown }).message === "string"
                  ? (raw as { message: string }).message
                  : exception.message,
          };
      response.status(status).json(body);
      return;
    }

    // Логуємо тільки тип і повідомлення: без тіл запитів, токенів і initData.
    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`${error.name}: ${error.message}`, error.stack);
    const body: ApiErrorBody = { code: "INTERNAL_ERROR", message: "Внутрішня помилка сервера" };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
