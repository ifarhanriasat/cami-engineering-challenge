# Decisions

## Prioritisation

Order: **CI → list performance → UI freshness → controller layering → history slice → docs.**

- **CI first**: it is a one-line cause and it gives a trustworthy safety net for everything
  after. I reproduced it locally before touching anything.
- **List performance next**: the highest-impact defect (1200 extra queries per request). I
  captured the old response first so I could prove the rewrite returns byte-identical JSON.
- **UI freshness** is small but user-visible, so it went before the larger refactor.
- **Controller layering before history**, because the history slice needs the classification
  logic to live in a service and behind a provider, so the refactor is the foundation.
- **Stretch (persistence port, deeper history)** was deliberately not built; see below.

## What was wrong and what I did

| # | Problem | Cause | Fix |
|---|---|---|---|
| 1 | `GET /requests` ~1s | N+1: one `request_notes` query per request (1200/call), loading every note just to count them and read the newest | Single query using two correlated subqueries (`COUNT(*)`, latest body) + composite index `request_notes(request_id, created_at DESC)`. ~1s → ~30ms; response verified identical to the old one on the 1200-row seed |
| 2 | Table stale after status/classify | Mutations never invalidated the `['requests']` query and `staleTime` is 10s | `onSuccess` invalidates `requests` and `history`; the mutation stays pending until the refetch lands. Row controls disable while in flight; errors are shown; the misleading "reported success" line is removed |
| 3 | CI red | Migrate step overrode `DATABASE_URL` to `.../cami_app`, a database the postgres service never creates | Removed the override so the job-level `DATABASE_URL` (which matches `POSTGRES_DB`) is used. Reproduced the exact failure (`database "cami_app" does not exist`) before fixing |
| 4 | Fat controller | Validation, business rules, persistence and `any` all in `classify`; errors returned as `{error}` with HTTP 200/201 | See below |
| 5 | No history | Stub endpoint | See below |

Also changed for CI robustness: `vitest.config.ts` → `vitest.config.mts`. The package is
CommonJS, so vitest 4 (ESM-only) loaded the config via `require(esm)`, which only works on
Node ≥ 20.19. It failed on Node 20.13 locally; `.mts` works on any Node 20.

## Controller / layering (task 4)

- **DTOs + global `ValidationPipe`** (`class-validator`, `whitelist` + `forbidNonWhitelisted`)
  replace hand-rolled checks. Bad input is now **HTTP 400 with a message list** instead of
  `{error: ...}` with a success status. This is a deliberate API behaviour change; the web
  client only ever checked `res.ok`, so it now gets real errors.
- `ParseUUIDPipe` on `:id` – a malformed id used to reach Postgres and 500.
- **`ClassificationService`** owns the flow (provider → rules → persist). **Pure
  `applyClassificationRules`** holds the two product rules (short-message softening,
  "unknown" below 0.55) unchanged, so they are unit-testable and apply to any provider.
- Controller is now routing only. `RequestsService.save()` was removed as unused.
- Not done: no drive-by changes to unrelated files, no restructuring of modules.

## Classification history (task 5)

**Implemented**
- `classification_events` table (+ entity, migration `1710000000001`, `down` implemented and
  round-trip tested). Columns: `request_id` (nullable, `ON DELETE SET NULL`), `message`
  snapshot, `category`, `confidence`, `provider`, `created_at`. Indexes for the two read
  patterns (`category, created_at DESC` and `created_at DESC`).
- Every classification is recorded, including ad-hoc ones with no `requestId`.
- **Request update + event insert are one transaction**, so the list and history cannot
  disagree. The provider call is made *before* the transaction so a slow provider never
  holds a DB connection.
- `GET /requests/history?category=&limit=` – newest first, validated category, `limit`
  default 50 / max 200. Response keeps the stub's `{ items }` envelope.
- **`ClassifierProvider` interface** (`name`, async `classify`) + `CLASSIFIER_PROVIDER` DI
  token; `KeywordClassifier` implements it. Swapping to an LLM is a one-line change in
  `RequestsModule`. The provider `name` is stored per row, so history stays interpretable
  when the provider or its version changes.
- `/history` page: category dropdown (replaces free-text), table with time / message /
  category / confidence / provider, empty and error states. Invalidated after classifying.

**Assumptions**
- "Classification history" means *every run*, not just the latest result per request.
- History rows are immutable and append-only; a request's current category is still
  `customer_requests.category` for the list view.
- Rules stay outside providers so results are comparable across providers.
- The message is copied into the event, not joined, because the request text could later
  be edited and history should record what was actually classified.

**Left out**
- Pagination/cursors on history (a `limit` only). Date-range filter, search.
- A real LLM provider, retries/timeouts, or a fallback chain (see failure modes below).
- Auth / per-user attribution on events.

## Trade-offs

- **Subqueries vs `GROUP BY`/join for the list.** Correlated subqueries are simple and, with
  the composite index, cost one index scan per row; a join+group would be similar. I chose
  the readable one and measured it rather than speculating.
- **`GET /requests` still returns all 1200 rows** while the UI shows 25. Fixing the query
  fixed the *scaling with notes*, which is what the task asked for. Pagination changes the
  API contract and the UI, so I left it and made the UI say "Showing the newest 25 of N"
  instead of silently truncating. This is the first thing I would do next.
- **Tests without a DB.** Service tests use in-memory fakes for the `EntityManager`/provider;
  DTO and rules tests are pure. I did **not** add a DB-backed integration test for the list
  query; instead I verified it against real Postgres manually (identical output, query
  count and latency). An integration test would need a Postgres service in the `test` job.
- **Query logging** was `['query']` always-on, which produced 1200 log lines per request and
  masked the N+1. It is now opt-in via `TYPEORM_LOG_QUERIES=true`.
- **`forbidNonWhitelisted`** is strict (unknown fields → 400). Good for catching client
  mistakes, but a public API with many clients might prefer to strip silently.

## Migration vs deploy ordering (stretch note)

Both new migrations are additive (new table, new index), so old and new API versions can run
against the migrated schema, which makes **"migrate first, then roll the app"** safe. The
reverse order is not: the new app would fail on the missing table. If a future change drops
or renames a column, use expand → migrate/backfill → contract across two deploys. In CI the
migration runs against a throwaway DB; in production it should run as a separate release step,
not on every app boot, so N replicas do not race. (`CREATE INDEX` is not `CONCURRENTLY` here;
on a large live `request_notes` table it should be, in its own non-transactional migration.)

## Failure modes for a future LLM provider (stretch note)

- **Latency/timeouts**: the interface is already async and called outside the DB
  transaction; add a per-call timeout and abort signal.
- **Provider errors**: today they propagate as a 500 and record nothing. Options are a
  fallback to `KeywordClassifier` (recording the actual provider used, which the `provider`
  column already supports) or a 503 with retry.
- **Non-deterministic / malformed output**: the provider must validate its output into the
  `category` union and clamp `confidence` to [0,1]; anything else is an error, not `unknown`.
- **Cost and abuse**: 2000-char cap already exists; add rate limiting before an LLM is behind
  this endpoint.
- **Auditability**: store model/prompt version in `provider` (e.g. `llm-model-x-prompt-v3`) so
  a category change can be traced to a prompt change.

## Verified how

Local Postgres 16 in Docker: migrations on a fresh DB, down/up round-trip, seed, old-vs-new
`GET /requests` byte-identical, endpoint behaviour (200/201/400/404 cases) via curl,
`npm ci --dry-run`, typecheck, 32 tests, and `npm run build`.
**Not verified in a real browser**: the React changes (invalidation, disabled state, history
page) are type-checked and built, but I did not click through them. I did not run the GitHub
Actions workflow itself; I ran each of its steps locally.

## What I would do with more time

1. Paginate `GET /requests` (cursor on `created_at,id`) and the table.
2. DB-backed integration test for the list query and the classify transaction (Postgres
   service is already available in CI).
3. Repository/port seam for the request and event stores (stretch #6). I did not do it: the
   service layer is now small enough that the port would mostly wrap `Repository<T>` without
   buying testability the fakes do not already give. It pays rent once there is a second store
   or non-trivial query logic worth isolating.
4. Lint (CI runs `lint --if-present`, but no lint is configured) and a web component test for
   the freshness behaviour.
5. Optimistic status updates.
