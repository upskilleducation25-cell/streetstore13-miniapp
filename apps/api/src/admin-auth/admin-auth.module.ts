import { Module } from "@nestjs/common";

import { AdminAuthController } from "./admin-auth.controller.js";
import { AdminAuthGuard } from "./admin-auth.guard.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { AdminsController } from "./admins.controller.js";
import { AdminsService } from "./admins.service.js";

@Module({
  controllers: [AdminAuthController, AdminsController],
  providers: [AdminAuthService, AdminsService, AdminAuthGuard],
  exports: [AdminAuthService, AdminAuthGuard],
})
export class AdminAuthModule {}
