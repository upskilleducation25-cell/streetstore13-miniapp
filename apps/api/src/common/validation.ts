import type { ValidationError } from "@nestjs/common";
import { HttpStatus, ValidationPipe } from "@nestjs/common";

import { AppException } from "./app-exception.js";

function flatten(
  errors: ValidationError[],
  parent = "",
): Array<{ field: string; errors: string[] }> {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, errors: Object.values(error.constraints) }] : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/** Глобальна валідація DTO: невідомі поля відкидаються, типи перетворюються. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) =>
      new AppException(
        "VALIDATION_ERROR",
        "Некоректні параметри запиту",
        HttpStatus.BAD_REQUEST,
        flatten(errors),
      ),
  });
}
