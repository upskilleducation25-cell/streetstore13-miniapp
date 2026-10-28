import { Module } from "@nestjs/common";

import { AdminAuthModule } from "../admin-auth/admin-auth.module.js";
import { EasyDropImportController } from "./easydrop-import.controller.js";
import { EasyDropImportService } from "./easydrop-import.service.js";
import { EasyDropSyncService } from "./easydrop-sync.service.js";

@Module({
  imports: [AdminAuthModule],
  controllers: [EasyDropImportController],
  providers: [EasyDropImportService, EasyDropSyncService],
})
export class SuppliersModule {}
