### EF/SQLite traps that only fail at request time

These throw when the query runs, not when it compiles, and the in-memory provider evaluates
past them — so **a projection test can pass while the endpoint 500s on every call**. Test
handlers, and test them against `TestsUtils.CreateSqliteDbContext()`.

- **Order before you project, never after.** `.SelectProjectSummariesFor(id).OrderByDescending(p => p.UpdatedAt)`
  asks EF to sort by a member of a constructed record and is untranslatable; move the
  `OrderBy` onto the entity queryable ahead of the `Select`. This shipped broken in L13 and
  went unnoticed until the dashboard became the first caller.
- **`DateTimeOffset` is stored as UTC `DateTime` — keep it that way.**
  `UtcDateTimeOffsetConverter` is applied by convention in `ApplicationDbContext.ConfigureConventions`
  to *every* `DateTimeOffset`. Remove it and SQLite goes back to storing
  `2026-07-02 22:00:00+00:00`, where `ORDER BY` throws `NotSupportedException` outright and a
  `WHERE` comparison silently degrades to a text comparison that is only right while every row
  shares an offset. The offset itself is never used — every date is an instant and the SPA
  renders in local time — so nothing is lost by collapsing it.

**`dotnet build` migrates your local dev database.** `Microsoft.Extensions.ApiDescription.Server`
starts the app to emit `BlitzTask.Backend.json`, and `Program.cs` runs `Database.Migrate()` on
startup, so building applies any pending migration to `Data/blitz-task.db` — including
data-rewriting ones. You will see `No migrations were applied` (or not) in the build output.
Back the file up before building with a destructive migration pending.

# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Blitz Task** — a self-hosted task/project manager (Kanban board + table view) intended to
cover work, school, dev projects and daily life in one place. Single maintainer (Levy).
Started 2026-06-17. Live in production since 2026-09-02 — see [ROADMAP.md](ROADMAP.md) Phase 2.

Two halves, one deployable unit:

- `server/BlitzTask.Backend` — ASP.NET Core 10 minimal API, EF Core + **SQLite**, cookie auth.
- `web/` — React 19 + TypeScript + Vite, TanStack Router/Query/Table, Tailwind v4 + shadcn/ui.

The backend **serves the built frontend**: `vite build` outputs into
`server/BlitzTask.Backend/wwwroot` (see `web/vite.config.ts`), and `Program.cs` ends with
`app.MapFallbackToFile("index.html")`. There is no separate frontend host in production.

## Commands

```bash
# Backend (from repo root)
dotnet run --project server/BlitzTask.Backend      # http://localhost:5121
dotnet test server/BlitzTask.Backend.Tests
dotnet ef migrations add <Name> --project server/BlitzTask.Backend
dotnet ef database update --project server/BlitzTask.Backend

# Frontend (from web/)
bun install
bun run dev            # http://localhost:5173, proxies /api -> localhost:5121
bun run build          # writes into ../server/BlitzTask.Backend/wwwroot
bun run api:gen        # regenerate the typed API client (see below)

bun test               # frontend unit tests (bun's built-in runner, no vitest)

# Lint / format (repo root) — Biome, not ESLint/Prettier
bunx biome check .
bunx biome check --write .
```

### Tests

Backend is xUnit (`dotnet test server/BlitzTask.Backend.Tests`). Frontend uses **bun's built-in
runner** — `*.test.ts` colocated with the module under test, inside `-components/` directories
so TanStack Router ignores them. Covered today: `toolbar-filters`, `grouping`,
`scoreBetween`/`columnScoreBetween`, the dashboard's `task-buckets`, and on the backend the RBAC
permission matrix plus the projections and handlers behind `GET /api/projects` and
`GET /api/tasks`. All the frontend coverage is pure-function testing; there is no component/DOM
test setup, so don't reach for one without adding it first.

**Test handlers, not only projections, and do it against `TestsUtils.CreateSqliteDbContext()`.**
Both EF traps below throw at request time and the in-memory provider evaluates past them, so a
green projection test is no evidence the endpoint works — `GET /api/projects` shipped 500ing on
every call for exactly that reason.

### Typechecking: use `tsc -b`, never `tsc --noEmit`

`web/tsconfig.json` is a solution-style config with `"files": []` and project references.
Bare `npx tsc --noEmit` compiles **nothing** and always exits 0 — it will happily report
success while the app has type errors. Always:

```bash
cd web && npx tsc -b
```

`tsc -b`, `bun test` and `biome check` are all clean and all gate CI, so **any** error is a
regression you introduced.

**Typechecking requires a build first.** `src/routeTree.gen.ts` is gitignored and emitted by
the TanStack Router vite plugin, so a fresh checkout has no route tree and `tsc -b` fails with
~22 errors — every `createFileRoute` collapses to `never`, and the real cause is buried at the
top as a single `Cannot find module './routeTree.gen'`. Run `bun run build` (or `bun run dev`)
before typechecking. This bites in CI and in any clean clone; locally it hides, because a
previous build leaves the file lying around.

Biome has a scoped override in `biome.json` turning off a11y and a few suspicious rules for
`web/src/components/ui/**`: those are vendored shadcn files that `shadcn add` overwrites, so
fixing their lint findings would be lost on the next update. Formatting is still enforced there.

## The API contract is generated — don't hand-edit it

`web/src/api/**` is generated by `@hey-api/openapi-ts` from
`server/BlitzTask.Backend/BlitzTask.Backend.json`, which is itself emitted by the backend
build (`Microsoft.Extensions.ApiDescription.Server`, `OpenApiDocumentsDirectory` in the
csproj). The chain is:

```
change a C# endpoint/model  ->  dotnet build server/BlitzTask.Backend  (rewrites the .json)
                            ->  cd web && bun run api:gen              (rewrites src/api/**)
```

Biome ignores `web/src/api` and `routeTree.gen.ts`. If a frontend type looks wrong, fix the
C# model and regenerate rather than patching the generated file.

**Endpoint changes need a full backend restart.** `dotnet run` does not pick up newly
registered routes. A request to a route that exists in source but not in the running process
now returns a **JSON 404** (`No API route matches /api/…`), so a 404 on an endpoint you can
see in the source almost always means "stale backend", not "wrong path".

That 404 is deliberate — `app.MapFallback("/api/{**path}", …)` sits ahead of
`MapFallbackToFile("index.html")`. Without it an unmatched API call returns **200 and
index.html**, and the typed client hands a component an HTML *string* where it expected an
array; the crash then surfaces as `x.map is not a function` somewhere far from the cause. It
bit twice before being fixed. It also removes the old 405-instead-of-404 on POST/PATCH, which
came from the file fallback only accepting GET and HEAD.

## Architecture notes

### Backend: vertical slices

`Features/<Area>/` each hold `*Endpoints.cs`, `*Models.cs`, `*Validators.cs`,
`*Configuration.cs` (EF mapping). Areas: `Auth`, `Projects`, `ProjectMembers`,
`ProjectColumns`, `ProjectTasks`, `Attachments`, `Shared`. Cross-cutting code lives in
`Infrastructure/` (`Data`, `Auth`, `Filters`, `Extensions`).

- **Auth**: cookie-based (`SameSite=Strict`), `PasswordHasher<User>` for hashing, plus an
  antiforgery token — the SPA fetches `/api/csrf-token` on boot (`web/src/main.tsx`) and
  echoes the `XSRF-TOKEN` cookie back as an `X-XSRF-TOKEN` header on every request.
- **Authorization**: an `"EmailConfirmed"` policy guards essentially every non-auth endpoint,
  plus a per-project RBAC layer — `ProjectRole` (Owner/Collaborator/Contributor/Viewer) maps
  to `ProjectPermission` values in `ProjectPermissions._permissions`
  (`Features/Projects/ProjectsModels.cs`), enforced by `RequireProjectPermissionFilter` as an
  endpoint filter. Add new permissions to that dictionary, not ad hoc in handlers.
- **Validation**: FluentValidation via `ValidationFilter<T>.Body()` / `.Form()` endpoint
  filters, returning `ValidationErrors` (422).
- **Email**: `MailerService` is `SmtpMailerService` in Development (expects a local catcher on
  port 1025, e.g. Mailpit) and `ResendMailerService` otherwise (needs `RESEND_API_KEY`).
  Templates are RazorLight `.cshtml` files under `Templates/Email/`, loaded from
  `Directory.GetCurrentDirectory()` — so the working directory matters at runtime.
- **Files**: `LocalFileService` writes to the `FileUpload:UploadDirectory` path (`Uploads/`)
  on local disk. Attachments are `Guid`-keyed rows in the DB pointing at those files.

### Frontend: file-based routes

TanStack Router with `autoCodeSplitting`; `routeTree.gen.ts` is generated — never edit it.
Conventions in `web/src/routes/`:

- `_app/` — authenticated shell (sidebar layout); `_auth/` — logged-out pages.
- `-components/`, `-schemas.ts` — the `-` prefix means "not a route", colocated with the route
  that owns them.
- Data loading is `useSuspenseQuery` + route `loader` calling
  `context.queryClient.ensureQueryData(...)`, using the generated
  `*Options`/`*Mutation`/`*QueryKey` helpers from `@/api/@tanstack/react-query.gen`.
- **A route component is not remounted when only its params change.** Navigating
  `/projects/1` → `/projects/2` reuses the same React instance, so every `useState` and every
  `useForm` `defaultValues` below it carries over from the previous record — silently, since
  the data itself updates correctly. `$projectId` sets `remountDeps: ({ params }) => params.projectId`
  for exactly this; any future route keyed by an entity id needs the same. The symptom is
  never an error: it is an edit form showing the record you opened first, or a filter from one
  project emptying another.

### The project board (the most intricate part)

`web/src/routes/_app/projects/$projectId/` — both views share one drag-and-drop hook.

- **Ordering is score-based.** Tasks and columns each carry a float `score`; a drop computes a
  new score between its neighbours (`scoreBetween` / `columnScoreBetween` in
  `use-drag-n-drop.ts`) and PATCHes `/move`. Tasks render **highest score first**, columns
  **lowest score first** — the neighbour semantics are deliberately flipped between them.
- **`useDragNDrop(project, toolbarState)` is the single source of render order.** It returns
  `effectiveColumns` — score-sorted at rest, the optimistic `move()` order mid-drag. **Never
  re-sort `effectiveColumns` in a view**; that cancels an in-progress drag. Both `board.tsx`
  and `table-view/index.tsx` carry comments saying so.
- **Toolbar filters/sort are applied inside the hook, not in the views.** The rendered task
  set, dnd-kit's sortable indices, the optimistic order and the drop-score neighbours must all
  derive from the same list; filtering in a view would leave dnd computing indices against the
  unfiltered set. `toolbar-filters.ts` holds `ToolbarState`, `taskMatchesFilters`, `sortTasks`.
- When a manual sort is active, `dragDisabled` is true — rendered order no longer follows
  `score`, so a drop's neighbours would produce a score that doesn't match where the task
  visually landed.
- **Optimistic cache writes must not rebuild columns from the drag order.** That order only
  contains tasks the filters leave visible; rebuilding from it silently drops hidden tasks out
  of the React Query cache. Move only the dragged task between columns.
- `OptimisticSortingPlugin` is stripped (`sortablePlugins`) because its direct DOM relocation
  races React's reconciliation and crashes on table rows.
- Table `groupBy` other than `"column"` renders `StaticGroupBody` with **no** dnd: a drag
  encodes "move to column X at score Y", which says nothing about priority/assignee/due date.

### Background jobs

`Infrastructure/Scheduling/` holds `ScheduledJobRunner` (a `BackgroundService` ticking once a
minute) and the `IScheduledJob` interface. To add recurring work, implement `IScheduledJob` in
the vertical slice that owns the domain — not in `Infrastructure/` — and register it
**scoped** (`AddScoped<IScheduledJob, YourJob>()`); the runner is a singleton and builds a DI
scope per tick, which is what lets a job take `ApplicationDbContext`.

Jobs must be idempotent and catch up on their own. The container is replaced on every deploy,
so a job cannot assume it ran on schedule or at all: query the database for outstanding work
rather than tracking progress in memory, and mark work done durably so a crash mid-run cannot
repeat a side effect like sending mail twice.

**Adding an entity is a chicken-and-egg with the build.** `dotnet build` starts the app to emit
the OpenAPI document, and the app migrates on startup, so a model change with no migration
fails the build — while `dotnet ef migrations add` needs a successful build. Break the cycle
with `dotnet build server/BlitzTask.Backend -p:OpenApiGenerateDocuments=false`, then
`dotnet ef migrations add <Name> --project server/BlitzTask.Backend --no-build`.

Tests that render an email template need `PreserveCompilationContext` (already set in both
csprojs): RazorLight compiles `.cshtml` at runtime and otherwise fails with "Can't load
metadata reference from the entry assembly". The backend's `Templates/Email` is copied into the
test output, so a test double that overrides only `SendEmailInternalAsync` still renders the
real template — which is how the templates get compile coverage at all.

## Conventions

- **Comments explain WHY, not what.** The existing comments in `use-drag-n-drop.ts` and the
  board components are the house style — they exist because the constraint is non-obvious and
  someone would otherwise "fix" the code and break a drag. Match that density; don't narrate.
- Backend formatting is CSharpier-style (trailing commas, collection expressions `[...]`,
  primary constructors where natural). Frontend is Biome: 2-space indent, double quotes.
- Prefer editing an existing vertical slice over adding a new cross-cutting layer.

## Deployment topology

Production is **Dokploy** on a VPS, pulling a prebuilt image from GHCR — the image is never
built on the host. `Dockerfile`, `docker-compose.yml` and `.github/workflows/ci-cd.yml` are
in place; the flow is:

```
push/merge to main  ->  GitHub Actions: build multi-stage image
                    ->  push to GHCR (tags: latest + commit SHA)
                    ->  POST the Dokploy deployment webhook  ->  Dokploy re-pulls
```

**The Dockerfile's stage order is load-bearing.** `web/src/api/**` is gitignored and generated
by openapi-ts from `BlitzTask.Backend.json`, which the backend build emits — so the backend
must build before the frontend. Reordering the stages breaks the build.

**Traefik discovery is network-scoped.** The compose service must join the external
`dokploy-network`; Dokploy's Traefik only watches that network, and the Domains-tab labels do
nothing for a container outside it. With no matching router Traefik returns **404 on every
path** — which looks like a broken SPA fallback rather than missing routing. Confirm the app
itself is fine before touching application code:

```bash
docker run --rm --network container:<container> curlimages/curl:latest \
  -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/login
docker inspect -f '{{json .Config.Labels}}' <container> | tr ',' '\n' | grep -i traefik
```

A 200 from the first with no output from the second means the container is healthy and the
problem is entirely upstream.

Three failure modes worth knowing before debugging a "successful" deploy:

- The webhook returns 200 for *accepting* the trigger, not for a successful pull. If the
  registry package is private and Dokploy has no credentials for it, the pull fails silently
  behind a green webhook response. Always verify the running image digest.
- SQLite (`Data/blitz-task.db`), uploads (`Uploads/`) and the Data Protection key ring
  (`Data/DataProtection-Keys/`) are on local disk. They **must** be on persistent volumes:
  losing the first two wipes all data and attachments, and losing the key ring logs every
  user out and invalidates their antiforgery tokens on each redeploy.
- Email templates are `None` items, deliberately taken away from the Razor SDK in the csproj
  (`Content Remove` + `None Include`). The SDK compiles `.cshtml` into the assembly and strips
  it from publish output, which leaves RazorLight with nothing to load at runtime. Don't
  "tidy" that back into a plain `Content` item.

## Production configuration

Everything below is set in Dokploy's Environment tab; `docker-compose.yml` declares the
required ones with `:?` so a deploy fails loudly rather than starting half-configured.

| Variable | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | yes | Read via `Environment.GetEnvironmentVariable` directly, not `IConfiguration` — it is the one setting that is not a config-section binding. |
| `Resend__FromEmail` | yes | Binds to `ResendSettings.FromEmail`. Must be a domain verified in Resend. |
| `Resend__FromName` | no | Defaults to `BlitzTask`. |
| `App__BaseUrl` | yes | This instance's public origin, e.g. `https://tasks.example.com`. Every emailed link is built from it. **Required, not derived**: the reminder sweep is a background job with no HTTP request to read a scheme and host from, so without this it throws rather than send a relative link. Inside a request it also wins over `X-Forwarded-Proto`, which is what L14 could not make reliable. |
| `ASPNETCORE_ENVIRONMENT` | set in Dockerfile | Anything other than `Development` selects `ResendMailerService` over SMTP. |
| `ASPNETCORE_HTTP_PORTS` | set in Dockerfile | 8080; Traefik's `loadbalancer.server.port` must agree. |
| `ConnectionStrings__DefaultConnection` | no | Defaults to `Data Source=Data/blitz-task.db`, which the volume covers. |

`__` is ASP.NET's separator for nested configuration, so `Resend__FromEmail` binds to the
`FromEmail` key of the `Resend` section.

**Development vs production mail diverge completely.** Development binds a `Smtp` section (from
`appsettings.Development.json`, expecting a local catcher on :1025); production binds a
`Resend` section that exists in **no** appsettings file — it comes purely from the environment.
Missing it does not throw at startup; `From` is silently `""` and every send fails at the API,
which reads as "the app is broken" because the `EmailConfirmed` policy gates nearly every
endpoint and no new account can get confirmed.

## Git

**Check the branch before committing.** `git rev-parse --abbrev-ref HEAD` — never carry the
branch name over from earlier in a session, because a merge on the maintainer's side switches
the working copy to `main` without any signal in the terminal.

A versioned `pre-commit` hook enforces this. Each clone opts in once:

```bash
git config core.hooksPath .githooks
```

It refuses commits on `main`/`master`, stays out of the way during merges, rebases,
cherry-picks and reverts, and allows a deliberate override via
`ALLOW_COMMIT_ON_MAIN=1 git commit ...`. Pushes to `origin/main` are blocked server-side too;
the hook exists so the mistake is caught at commit time rather than after the work has piled up
on the wrong branch.

## Known gotchas

- `.gitignore` at `server/BlitzTask.Backend/.gitignore` ignores `wwwroot/*`, so `vite build`
  output never dirties the tree.
- Migrations **are** applied at startup — `Program.cs` runs `dbContext.Database.Migrate()` in a
  scope right after `builder.Build()`, so a fresh checkout or an empty volume brings itself up.
- Email links are built from the incoming request via `context.BuildAppUrl(path)` — the server
  has no configured base URL to name itself from. That is only correct because
  `app.UseForwardedHeaders()` runs **first** in the pipeline and rewrites `Scheme`/`Host` from
  Traefik's headers. `ForwardedHeadersSetup` clears `KnownNetworks`/`KnownProxies` because the
  default trust list is loopback only and Traefik arrives over a Docker network; without that
  the headers are parsed and then silently dropped. Safe only while the container publishes no
  port of its own — expose it directly and this becomes a spoofing vector.
- **Don't add `UseHttpsRedirection`.** Kestrel listens on plain HTTP 8080 and Traefik already
  redirects at the edge, so it would be a no-op for real traffic — except for the container
  healthcheck, which curls `http://localhost:8080/health` with no forwarded headers and would
  start receiving a redirect instead of a 200.
- **The sidebar never unmounts.** It lives in the `_app` layout, so unlike a route component it
  does not remount and refetch on navigation — React Query's default `staleTime: 0` heals the
  dashboard but not the sidebar. Anything that changes which projects exist or what they are
  called must call `invalidateProjectLists` (`web/src/lib/query-invalidation.ts`), or a deleted
  project lingers in the sidebar until a full reload and clicking it 404s.
- An endpoint with a `ValidationFilter` must also declare
  `.Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity)`. The filter returns
  422 at runtime regardless, but without the declaration it is absent from the OpenAPI document,
  so the generated client's error union omits the validation case and frontend code that reads
  `error.errors` cannot typecheck.

### Two EF/SQLite traps that only fail at request time

Both throw when the query runs, not when it compiles, and the in-memory provider evaluates
past both — so **a projection test can pass while the endpoint 500s on every call**. Test
handlers, and test them against `TestsUtils.CreateSqliteDbContext()`.

- **Order before you project, never after.** `.SelectProjectSummariesFor(id).OrderByDescending(p => p.UpdatedAt)`
  asks EF to sort by a member of a constructed record and is untranslatable; move the
  `OrderBy` onto the entity queryable ahead of the `Select`. This shipped broken in L13 and
  went unnoticed until the dashboard became the first caller.
- **SQLite cannot `ORDER BY` a `DateTimeOffset`.** EF throws `NotSupportedException` outright.
  Worse, *comparing* one in a `WHERE` doesn't throw — it degrades to a text comparison over
  `2026-07-02 22:00:00+00:00`-style strings, which is only correct while every row carries the
  same offset. `GET /api/tasks` therefore filters and sorts by due date **in memory**
  (`InDashboardOrder`), deliberately. ROADMAP L50 tracks fixing the storage type; until then,
  don't move due-date logic into a query.
