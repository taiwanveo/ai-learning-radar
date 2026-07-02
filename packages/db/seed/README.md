# Database seed

`npm run db:seed` idempotently creates the default `人工智慧` topic, the 12
PRD subtopics, their initial multilingual keywords, and the default search
settings.

Owner creation is explicit and optional. Generate a memory-hard scrypt hash
with `npm run admin:hash-password --workspace @ai-learning-radar/web` (the CLI
reads hidden stdin), then provide all three variables when running the seed:

```bash
ADMIN_OWNER_EMAIL=owner@example.com \
ADMIN_OWNER_NAME='Owner' \
ADMIN_OWNER_PASSWORD_HASH='<externally-generated-hash>' \
npm run db:seed
```

The seed never accepts or hashes a plaintext password. Omitting all three
variables seeds taxonomy only. Providing an incomplete set fails without
writing anything.

`docs/Deployment.md` uses the same `ADMIN_OWNER_*` contract.

`npm run db:seed:test` validates seed content without a database connection.

## Demo preview data

`npm run db:seed:demo` first applies the regular taxonomy seed, then creates 20
published content fixtures, scores, tags, summaries, three quiz questions per
item, and a complete daily snapshot. Every title starts with `[DEMO]`, every URL
uses `example.com`, and raw metadata identifies the record as a fixture; the
seed cannot be mistaken for real YouTube content.

Validate this data without PostgreSQL with `npm run db:seed:demo:test`.
