-- trust_weight now scales the recommended-channel ranking boost on a 0..1
-- scale (1 = full boost). Older rows used an unused -10..10 field defaulted
-- to 0, which would silently zero out the boost, so normalize them.
ALTER TABLE "channels" ALTER COLUMN "trust_weight" SET DEFAULT 1;
UPDATE "channels"
SET "trust_weight" = 1
WHERE "list_type" = 'recommended' AND ("trust_weight" <= 0 OR "trust_weight" > 1);
