-- min_engagement_score becomes a hard like/view-ratio filter in the worker.
-- The old 0.05 default (a 5% like ratio) is too aggressive for a hard gate,
-- so lower the default and any rows still holding the old seeded default.
ALTER TABLE "topic_search_settings" ALTER COLUMN "min_engagement_score" SET DEFAULT 0.02;
UPDATE "topic_search_settings" SET "min_engagement_score" = 0.02 WHERE "min_engagement_score" = 0.05;
