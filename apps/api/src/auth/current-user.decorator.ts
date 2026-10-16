import type { ExecutionContext } from "@nestjs/common";
import { createParamDecorator } from "@nestjs/common";

import type { User } from "../generated/prisma/client.js";
import type { AuthenticatedRequest } from "./telegram-auth.guard.js";

/** Поточний покупець. Працює тільки разом з TelegramAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new Error("CurrentUser використано без TelegramAuthGuard");
  return user satisfies User;
});
