-- CreateIndex
CREATE INDEX "product_variants_color_id_size_id_idx" ON "product_variants"("color_id", "size_id");

-- CreateIndex
CREATE INDEX "product_variants_size_id_idx" ON "product_variants"("size_id");

-- CreateIndex
CREATE INDEX "products_status_created_at_idx" ON "products"("status", "created_at");

-- CreateIndex
CREATE INDEX "products_status_price_idx" ON "products"("status", "price");
