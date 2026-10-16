import { Module } from "@nestjs/common";

import { AdminAuthModule } from "../admin-auth/admin-auth.module.js";
import { AdminCategoriesController } from "./admin-categories.controller.js";
import { AdminCategoriesService } from "./admin-categories.service.js";
import { AdminDictionariesController } from "./admin-dictionaries.controller.js";
import { AdminDictionariesService } from "./admin-dictionaries.service.js";
import { AdminImagesService } from "./admin-images.service.js";
import { AdminProductsController } from "./admin-products.controller.js";
import { AdminProductsService } from "./admin-products.service.js";

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminProductsController, AdminCategoriesController, AdminDictionariesController],
  providers: [
    AdminProductsService,
    AdminImagesService,
    AdminCategoriesService,
    AdminDictionariesService,
  ],
})
export class AdminCatalogModule {}
