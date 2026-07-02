# T00-01 Repository Audit

## Audit scope

Audit date: 2026-07-02

The workspace contains only the AI Learning Radar engineering document set under
`docs/`. It is not a Git checkout and does not contain the referenced
`SunFish98/VideoDigestAgent` source tree.

## Files available for audit

- Product and engineering specifications in `docs/*.md`.
- `docs/ai-learning-radar-docs.zip`, which contains the same documentation set.

## Original repository modules

The architecture document says the original repository contains YouTube channel
monitoring, keyword search, transcript extraction, LLM summarization, a Flask web
UI, a CLI, Bilibili monitoring, local history, and email output. None of those
source files are present in this workspace, so their implementation quality,
licenses, dependencies, tests, and reusable interfaces cannot be verified.

| Area | Audit decision | Reason |
|---|---|---|
| YouTube search | Reassess when legacy source is supplied | The API interaction may be reusable, but no code is available. |
| Transcript extraction | Reassess when legacy source is supplied | Adapter isolation is required by the new architecture. |
| LLM summarization | Reassess when legacy source is supplied | New JSON schemas and prompt versioning materially change the contract. |
| CLI | Rewrite | The new worker CLI and run logging contract are fully specified. |
| Flask UI | Do not reuse for the product UI | The target architecture requires Next.js. |
| Local history | Replace | PostgreSQL is the system of record. |
| Email output | Remove from the primary flow | It is outside the MVP scope. |
| Bilibili monitor | Defer | Bilibili ingestion is explicitly outside the MVP scope. |

## Migration risks

1. Legacy behavior cannot be regression-tested until the original source is supplied.
2. YouTube quota handling and transcript edge cases may need to be rediscovered.
3. Any legacy dependency licenses must be reviewed before code is copied.
4. The documented legacy feature inventory may not match the exact upstream revision.
5. A later legacy import must not replace the new database, API, prompt, or package contracts without an explicit migration decision.

## Bootstrap decision

Proceed with a clean monorepo scaffold based on `Architecture.md`. Keep
`legacy/VideoDigestAgent/` reserved for a future, traceable import. Once the
source is supplied, perform a second audit and extract only verified adapter
logic behind the new interfaces.
