import type { ExecutionContext } from "@nestjs/common";
import { createParamDecorator } from "@nestjs/common";

import type { SessionWithAdmin } from "./admin-auth.service.js";
import type { AdminRequest } from "./admin-auth.guard.js";

/** Поточна сесія адміна (з admin усередині). Працює тільки разом з AdminAuthGuard. */
export const CurrentAdminSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionWithAdmin => {
    const session = context.switchToHttp().getRequest<AdminRequest>().adminSession;
    if (!session) throw new Error("CurrentAdminSession використано без AdminAuthGuard");
    return session;
  },
);
