-- Singleton table backing the admin console's "暫停排程 / 重啟排程" toggle.
-- The scheduled GitHub Actions run checks this flag before doing any work;
-- manual (workflow_dispatch) runs ignore it.
CREATE TABLE "schedule_control" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "paused_at" TIMESTAMPTZ,
    "paused_by_admin_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_control_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "schedule_control" ADD CONSTRAINT "schedule_control_paused_by_admin_id_fkey"
  FOREIGN KEY ("paused_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "schedule_control" ("id") VALUES ('singleton');
