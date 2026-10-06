import { HttpException, HttpStatus } from "@nestjs/common";
import type { ApiErrorBody } from "@ss13/shared";

/** Помилка з машинним кодом; фільтр перетворює її на ApiErrorBody. */
export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus,
    readonly details?: unknown,
  ) {
    const body: ApiErrorBody = { code, message, ...(details === undefined ? {} : { details }) };
    super(body, status);
  }
}

export const notFound = (code: string, message: string) =>
  new AppException(code, message, HttpStatus.NOT_FOUND);
