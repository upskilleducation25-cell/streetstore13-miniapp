import { Module } from "@nestjs/common";

import { AdminAuthModule } from "./admin-auth/admin-auth.module.js";
import { AdminCatalogModule } from "./admin-catalog/admin-catalog.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CartModule } from "./cart/cart.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthController } from "./health/health.controller.js";
import { OrdersModule } from "./orders/orders.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { StorageModule } from "./storage/storage.module.js";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    StorageModule,
    AuthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    AdminAuthModule,
    AdminCatalogModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
