-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_token" TEXT NOT NULL,
    "admin_id" UUID NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_login_attempts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions"("admin_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "admin_login_attempts_email_created_at_idx" ON "admin_login_attempts"("email", "created_at");

-- CreateIndex
CREATE INDEX "admin_login_attempts_ip_created_at_idx" ON "admin_login_attempts"("ip", "created_at");

-- CreateIndex
CREATE INDEX "admin_login_attempts_created_at_idx" ON "admin_login_attempts"("created_at");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ручна зміна складу завжди з причиною.
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_manual_note" CHECK ("reason" <> 'MANUAL' OR "note" IS NOT NULL);
