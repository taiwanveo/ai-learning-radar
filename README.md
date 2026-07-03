# AI Learning Radar

AI Learning Radar is a Traditional Chinese daily learning digest for YouTube AI
tutorials. The repository is organized as a Next.js web application, a Python
ingestion worker, shared packages, and PostgreSQL migrations.

## Workspace

- `apps/web` — public dashboard, admin console, and HTTP APIs.
- `workers/ingestion` — scheduled YouTube ingestion and analysis pipeline.
- `packages/db` — Prisma schema, migrations, and seed entry points.
- `packages/shared` — cross-application TypeScript contracts.
- `docs` — product, architecture, implementation, and operations documents.

## Bootstrap checks

```bash
npm install
npm test
npm run typecheck
python3 -m venv .venv
. .venv/bin/activate
pip install -e './workers/ingestion[dev]'
pytest workers/ingestion/tests
```

The MVP requirements and implementation order are defined in `docs/README.md` and `docs/Tasks.md`.

## Required CI checks

Protect the production branch and require all three checks before merge:

- **Web CI / test** — shared/web typecheck, tests, and production build.
- **Worker CI / test** — Python tests and Ruff.
- **Database CI / validate** — Prisma/migration validation and regular/demo seed validation.

CI never calls YouTube or an LLM. Provider and ingestion tests use local fakes.

Create the first owner without putting a plaintext password in shell history:

```bash
npm run admin:hash-password --workspace @ai-learning-radar/web
ADMIN_OWNER_EMAIL=owner@example.com \
ADMIN_OWNER_NAME='Owner' \
ADMIN_OWNER_PASSWORD_HASH='<generated-scrypt-hash>' \
npm run db:seed --workspace @ai-learning-radar/db
```

## Phase 2 worker

The worker can now search YouTube, fetch Chinese transcripts, run structured LLM
analysis, score candidates, and persist a daily snapshot. Before a real run:

1. Create a PostgreSQL database and copy `.env.example` to a private `.env`.
2. Set `DATABASE_URL`, `YOUTUBE_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, and the
   selected provider API key. The current production mode uses
   `TRANSCRIPT_MODE=disabled` and `QUIZ_ENABLED=false`; summaries are generated
   only from YouTube titles and descriptions.
3. Apply and seed the database:

```bash
cd packages/db
npm run db:migrate:deploy
npm run db:seed
cd ../..
```

4. Export the private environment file and run the worker:

```bash
set -a
. ./.env
set +a
.venv/bin/python -m ai_learning_radar_worker.cli validate-config
.venv/bin/python -m ai_learning_radar_worker.cli daily --dry-run
.venv/bin/python -m ai_learning_radar_worker.cli daily
```

Process one video with:

```bash
.venv/bin/python -m ai_learning_radar_worker.cli test-video \
  --url 'https://www.youtube.com/watch?v=<video-id>'
```

`--dry-run` still reads PostgreSQL settings and calls YouTube/LLM APIs, but does
not write run, content, score, or snapshot records.
