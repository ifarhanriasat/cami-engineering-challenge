# AI Usage

## Tools used

Claude Code (Claude Sonnet 5) in VS Code, driving the shell, editor and a local Docker
Postgres. No other AI tools.

## How I used AI

- **Exploration first**: it read the README and all relevant source, then proposed a plan
  (root cause per task, ordering) *before* changing anything. I approved the plan.
- **Reproduce before fixing**: it ran the untouched project to get a baseline: 1200 notes
  queries and ~1s per `GET /requests`, the exact CI failure (`database "cami_app" does not
  exist`), and the stubbed history endpoint.
- **Implementation**: drafted the migration, entity, DTOs, service, provider interface,
  controller, web changes and tests.
- **Verification against a real database**: captured the old `GET /requests` response,
  applied the change, and diffed the two (byte-identical). Also ran curl checks on every
  error path, a migration down/up round-trip, and each CI step locally.
- **Docs**: drafted `DECISIONS.md`, which I reviewed and own.

## What I changed or rejected

Things the AI got wrong or that needed correcting during the work:

- **Environment assumption.** It assumed the Docker Postgres would be reachable on 5432. A
  native Windows Postgres already owned that port and rejected the credentials
  (`auth_failed`). It diagnosed this with `netstat` and did **not** kill the local process;
  it ran the challenge DB on 5433 instead. No repo files were changed for this.
- **Vitest failed locally** (missing native rolldown binding, then `ERR_REQUIRE_ESM` on
  Node 20.13). It worked around the first by hand-unpacking the binding into `node_modules`
  (untracked) and the second with a CLI flag, then made the real fix (`vitest.config.mts`)
  rather than leaving a local-only workaround.
- **Stale error message in the UI.** Its first `page.tsx` showed
  `createMutation.error ?? statusMutation.error ?? classifyMutation.error`, so an old
  failure would keep showing after a later success. Caught on self-review and changed to
  show only the most recent mutation's error.
- **A pointless line in a test** (`void ClassificationEvent` "to keep the import honest")
  was removed together with the unused import.
- **Alternative considered and dropped: `find()` + `relations: { notes: true }` for the
  list.** It would fix the N+1 but still load ~4800 rows just to compute a count and a
  preview. Used correlated subqueries + an index instead.
- **Deliberately not done: a repository/port layer** (stretch #6). The service is small
  enough that it would only wrap `Repository<T>`. Reasoning is in `DECISIONS.md`.
- **A shell command failed to parse** (a large heredoc mixing bash and Python). Nothing was
  applied; it was redone with the file-write tool. The AI checked what had actually been
  written before retrying instead of assuming.

## Trade-offs

- I asked for the plan and a baseline run before any edits; that cost some time up front but
  meant every claim in `DECISIONS.md` (before/after timing, identical output) is measured.
- The GitHub Actions workflow itself was not executed; each of its steps was run locally.

## Team workflow (optional stretch)

If I were setting standards for AI-assisted work on a team:

1. **Reproduce first.** AI proposals for a bug must come with a failing test or measurement;
   "looks right" is not evidence.
2. **Author owns the diff.** The person opening the PR must be able to explain every line,
   including AI-written ones; walkthroughs are the check.
3. **Small, reviewable PRs**, no drive-by rewrites, because AI makes large diffs cheap and
   review is the scarce resource.
4. **Don't let it touch shared state silently**: it may run local commands, but pushes,
   migrations against shared environments and destructive commands stay human-approved.
5. **Record what it got wrong** (as above). It is the cheapest way to build shared intuition
   about where the tools fail in this codebase.
