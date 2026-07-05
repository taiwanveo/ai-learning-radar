-- Manual runs are created as `queued` by the admin console and flipped to
-- `running` once the ingestion worker claims them.
ALTER TYPE "run_status" ADD VALUE IF NOT EXISTS 'queued' BEFORE 'running';
