import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthController } from "./health/health.controller.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, CatalogModule],
  controllers: [HealthController],
})
export class AppModule {}
