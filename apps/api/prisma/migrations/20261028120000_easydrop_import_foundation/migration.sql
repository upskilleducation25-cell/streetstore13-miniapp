-- EasyDrop import foundation: keep supplier identity and sync audit history.
CREATE TABLE "supplier_feed_items" (
    "id" UUID NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT 'EASYDROP',
    "external_id" TEXT NOT NULL,
    "vendor_code" TEXT,
    "group_id" TEXT,
    "product_variant_id" UUID,
    "is_present" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "supplier_feed_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_sync_runs" (
    "id" UUID NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT 'EASYDROP',
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "hidden_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "summary" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "supplier_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_feed_items_supplier_external_id_key"
    ON "supplier_feed_items"("supplier", "external_id");
CREATE UNIQUE INDEX "supplier_feed_items_product_variant_id_key"
    ON "supplier_feed_items"("product_variant_id");
CREATE INDEX "supplier_feed_items_supplier_vendor_code_idx"
    ON "supplier_feed_items"("supplier", "vendor_code");
CREATE INDEX "supplier_feed_items_supplier_is_present_idx"
    ON "supplier_feed_items"("supplier", "is_present");
CREATE INDEX "supplier_sync_runs_supplier_started_at_idx"
    ON "supplier_sync_runs"("supplier", "started_at");
CREATE INDEX "supplier_sync_runs_status_started_at_idx"
    ON "supplier_sync_runs"("status", "started_at");

ALTER TABLE "supplier_feed_items"
    ADD CONSTRAINT "supplier_feed_items_product_variant_id_fkey"
    FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
