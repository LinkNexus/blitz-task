# Project Roadmap — Blitz Task

**Start:** June 17, 2026 | **Deadline:** none — personal project, shipped when it's good

Blitz Task is a self-hosted task manager meant to cover **work, school, dev projects and
daily life** in one place. Single contributor (Levy) throughout; there is no split of tasks
between people.

Phase 1 is the foundation that already exists and works locally. **Phase 2 is the current
priority** — the app has never been deployed, and a handful of concrete gaps (no project
list, stub dashboard, no container, no migration-on-boot) stand between "runs on my laptop"
and "runs on a VPS and I actually use it daily".

The overall approach: **make it deployable first, then make it personal, then make it
collaborative, then make it clever.** A tool you can't reach from your phone at 9pm is a tool
you won't use, so hosting comes before features.

Architecture context and house conventions live in [CLAUDE.md](CLAUDE.md).

---

## Phase 1 — Foundations (June 17 → September 2) — **done**

**Goal:** A working local app: accounts, projects, a Kanban board and a table view with real
drag-and-drop ordering.

| # | Task | Notes |
|---|------|-------|
| L1 | ✅ **Backend + frontend scaffold** | ASP.NET Core 10 minimal API with EF Core/SQLite, vertical-slice `Features/` layout; React 19 + Vite + TanStack Router/Query, Tailwind v4 + shadcn/ui. Backend serves the SPA from `wwwroot` via `MapFallbackToFile` — one deployable unit, no separate frontend host. |
| L2 | ✅ **Typed API contract generation** | Backend build emits `BlitzTask.Backend.json` (OpenAPI) via `Microsoft.Extensions.ApiDescription.Server`; `bun run api:gen` turns it into `web/src/api/**` through `@hey-api/openapi-ts`, including TanStack Query option/mutation helpers. No hand-written fetch calls anywhere. |
| L3 | ✅ **Accounts & auth** | Register, login, logout, email confirmation, password reset. Cookie auth (`SameSite=Strict`) + antiforgery: SPA fetches `/api/csrf-token` on boot and echoes `XSRF-TOKEN` as `X-XSRF-TOKEN`. `PasswordHasher<User>` for hashing. An `"EmailConfirmed"` authorization policy gates every non-auth endpoint. |
| L4 | ✅ **Transactional email** | `MailerService` abstraction with two implementations — SMTP in Development (local catcher on :1025), Resend in Production. RazorLight `.cshtml` templates under `Templates/Email/` for confirmation, password reset and project invitation. |
| L5 | ✅ **Projects CRUD + RBAC** | Create/read/update/delete with name, description, tags, start/due dates and a cover image. Four roles (Owner/Collaborator/Contributor/Viewer) mapped to seven `ProjectPermission` values in one `ProjectPermissions._permissions` dictionary, enforced by `RequireProjectPermissionFilter` as an endpoint filter rather than ad hoc checks in handlers. |
| L6 | ✅ **Project membership & invitations** | Invite by email (tokened `ProjectInvitation` with a Guid), accept/decline via a dedicated route, change role, remove member, leave project. All endpoints exist and work; the *management UI* is still stubbed — see L20. |
| L7 | ✅ **Columns CRUD + reordering** | Create/rename/recolor/delete, plus `PATCH /{columnId}/move`. Columns render lowest-score-first. |
| L8 | ✅ **Tasks CRUD** | Name, markdown description, priority (LOW→URGENT), tags (max 5), start/due dates, multiple assignees, up to 5 file attachments. Task detail opens in a sheet. |
| L9 | ✅ **File attachments** | `LocalFileService` writing to disk under `FileUpload:UploadDirectory`, Guid-keyed `Attachment` rows, content-type/extension allowlist and a 10MB cap, served back through an authorized project-scoped endpoint. |
| L10 | ✅ **Kanban board with drag-and-drop** | Score-based ordering: a drop computes a score between its neighbours (`scoreBetween`) and PATCHes `/move`, so reordering never rewrites the whole column. Optimistic order held in React state during the drag; `OptimisticSortingPlugin` stripped because its direct DOM relocation races React's reconciliation. |
| L11 | ✅ **Table view** | TanStack Table v9 rendering the same data grouped by column, with the same drag-and-drop model (rows and column groups both draggable). Shook out a `removeChild` crash caused by the dnd plugin fighting React over `<tbody>` children — same fix as L10. |
| L12 | ✅ **Toolbar: filter, sort, group** | Search across name/description/tags, filter by priority / due bucket / assignee, sort by 5 fields, group the table by column/priority/assignee/due date. Filtering and sorting are applied **inside `useDragNDrop`**, not in the views, so the rendered set, dnd-kit's sortable indices, the optimistic order and drop-score neighbours all derive from one list. Manual sort disables task dragging (score no longer matches visual order). Non-column groupings render a static, non-draggable body — a drag encodes "move to column X at score Y", which says nothing about priority or assignee. Fixed an optimistic-cache bug found here: rebuilding columns from the drag order dropped filtered-out tasks out of the React Query cache entirely. |

---

## Phase 2 — Deployable MVP (current priority)

**Goal:** Blitz Task running on a real host, reachable from a phone, surviving restarts,
with no dead ends in the core navigation. This is the smallest set of work that turns the
project into something usable daily.

The blockers are unglamorous and mostly infrastructural. The two that made the app
"unusable at all" — L13 and L15, with no way to navigate back to a project you had just
created — are done; what remains is navigation dead ends (L15.5) and stubbed UI (L20).

| # | Task | Notes |
|---|------|-------|
| L13 | ✅ **`GET /api/projects` — list the current user's projects** | New `ProjectSummary` DTO and `SelectProjectSummariesFor(userId)` projection, deliberately narrower than `ProjectDetails` — that record drags every column, task, participant and invitation with it, which is right for one project and far too much for a list. Membership *is* the filter (`Participants.Any(pp => pp.UserId == userId)`), so there is no separate permission check: a project you don't participate in simply isn't in the result. `Role` is the requesting user's own role. Ordered most-recently-updated first. Covered by 5 tests running against **real SQLite** rather than the in-memory provider — the risk worth testing is whether EF can translate the per-user role subquery, and the in-memory provider evaluates client-side and would pass regardless. |
| L14 | **Reverse-proxy correctness** | Email links are built from `context.Request.Scheme`/`Host` (`AuthEndpoints.cs:233,415`, `ProjectMembersEndpoints.cs:135`) with no `UseForwardedHeaders`. In practice this is **less severe than it first looks**: Traefik forwards the original `Host`, so links point at the right domain and only the *scheme* is wrong — `http://` instead of `https://` — which the edge redirects away. Confirmed empirically, since account confirmation works in production. Still worth fixing: the links are one HSTS-less client or one redirect-stripping mail client away from breaking, and anything that later reads `Request.IsHttps` (secure-cookie decisions, canonical URLs) will be wrong. Needs `UseForwardedHeaders` with `XForwardedFor\|XForwardedProto` and a known-proxy config, plus `UseHttpsRedirection`/`UseHsts` outside Development. Downgraded from blocker to cleanup. |
| L15 | ✅ **Real dashboard** | `routes/_app/dashboard/index.tsx` replaces the one-line placeholder. Four stat tiles (overdue / due today / this week / projects), an "Up next" list of open tasks grouped into due-date sections, and a projects panel from L13. Two decisions worth recording: (1) it defaults to **all** open tasks, not "assigned to me" — in a solo project almost nothing is ever assigned, so filtering by assignee out of the box would show an empty dashboard to the app's own main use case; the filter is a `Link` into `?assignedToMe=true` so the choice survives a reload and the loader can prefetch. (2) The due-date bucket arithmetic moved from the board toolbar to `@/lib/due-dates`, re-exported from `toolbar-filters.ts` so the toolbar, the table grouping and its tests keep their import path — three surfaces sorting tasks into the same buckets is exactly where a duplicated copy drifts into a task reading "overdue" on one screen and "later" on another. `dueBucketOf` returns null for both undated and far-future tasks, which the dashboard must tell apart ("no due date" is work without a deadline; "Later" is work with one you aren't near yet) — 9 tests cover that split, the section ordering and the counts. |
| L15.5 | **Client-side not-found redirects to `/dashboard`** | An unknown URL currently serves `index.html` (the server fallback is universal by design) and then dies in the router with no route matched. TanStack Router's `notFoundComponent` / `defaultNotFoundComponent` on the root route should redirect to `/dashboard` instead of leaving a blank or bare 404 — a dead end in a task app is worse than landing somewhere useful. Note this is purely client-side: the server must keep returning 200 + `index.html` for unknown paths, since it cannot know which paths the router owns. Depends on L15 for `/dashboard` to be worth landing on. |
| L16 | ✅ **Cross-project task query endpoint** | `GET /api/tasks`, returning a new `UserTaskSummary` (task fields plus the owning project and column, minus attachments — a list never renders them). Lives outside the `/api/{projectId:int}/tasks` group because there is no single project to run `RequireProjectPermissionFilter` against: **membership is the authorization**, applied inside the query, so a project you aren't in contributes no rows. The other group's `:int` constraint means the literal `tasks` can never bind as a `projectId`, so the routes cannot collide. Filters: `assignedToMe`, `dueBefore`, `includeCompleted`, `projectId`, `limit` (clamped 1–200). There is no "done" flag on a task — the board expresses completion as position — so `IsCompleted` is "sits in its project's highest-score column", kept identical to the frontend's overdue test. **The SQLite-backed tests earned their keep immediately**: SQLite cannot `ORDER BY` a `DateTimeOffset` and EF throws outright, so the first version of this endpoint would have 500'd on every request; the in-memory provider would have passed it. See L50. Covered by 22 tests across the projection and the handler's filter composition. |
| L17 | ✅ **Apply migrations at startup** | `Program.cs` now runs `dbContext.Database.Migrate()` in a scope right after `builder.Build()`, and creates the SQLite data directory first (SQLite will not create one, and a fresh deploy mounts an empty volume). The uploads directory is created the same way from `FileUploadSettings.UploadDirectory`. Verified: a container started against an empty volume applies all 6 migrations and serves traffic. |
| L18 | ✅ **Dockerfile + compose** | Four-stage build, and the stage order is forced rather than stylistic: `web/src/api/**` is gitignored and generated by openapi-ts from `BlitzTask.Backend.json`, which the **backend build emits** — so backend build → `api:gen` → `vite build` → publish → runtime. Two bugs found and fixed by actually running the image: (1) the Razor SDK compiles `.cshtml` into the assembly and **strips it from publish output**, so RazorLight found no email templates in the container — fixed by taking `Templates/**` away from the Razor SDK entirely (`Content Remove` + `None Include` with `CopyToPublishDirectory`); (2) Data Protection keys defaulted to `/root/.aspnet/DataProtection-Keys`, outside any volume — every redeploy would have silently logged out every user and started rejecting their antiforgery tokens. Now persisted to `Data/DataProtection-Keys` with `SetApplicationName`, verified to survive container replacement. `docker-compose.yml` targets Dokploy Compose mode against the GHCR image, with named volumes for `/app/Data` and `/app/Uploads`. Image is 487MB. |
| L19 | ✅ **CI: build, test, lint on every push and PR** | `.github/workflows/ci-cd.yml`. `backend` job runs `dotnet build`/`dotnet test` on the `.slnx` and uploads `BlitzTask.Backend.json` as an artifact; `frontend` job downloads it, runs `api:gen`, `tsc -b`, `bun test`, `vite build` and `biome check`. The artifact hop is not incidental — the frontend genuinely cannot typecheck without a backend build. Every step **gates** (no `continue-on-error`) now that L21/L22 have cleared the backlog. |
| L19.5 | ✅ **CD: build image → GHCR → Dokploy webhook** | Same workflow, `deploy` job gated on `github.ref == 'refs/heads/main' && github.event_name == 'push'` and `needs: [backend, frontend]` — one workflow rather than two so the gate is a real dependency instead of `workflow_run`, which fires regardless of the first workflow's conclusion. Pushes to `ghcr.io/linknexus/blitz-task` with `latest` + long SHA tags via `docker/metadata-action` (which also lowercases the repo name — ghcr rejects uppercase), authenticating with the workflow's own `GITHUB_TOKEN` under `packages: write`, so there is no registry PAT to rotate. Layer cache via `type=gha`. **Verified end to end**: the first run silently skipped the webhook because `DOKPLOY_WEBHOOK_URL` was unset — the `if:` guard skips rather than fails, so the pipeline went green while nothing deployed. With the secret set, the full chain builds, pushes and redeploys. Remember the webhook returns 200 for accepting the trigger, not for a successful pull; confirm the running digest after a deploy that matters. |
| L20 | **Finish member management UI** | `project-members/index.tsx` has `handleChangeRole`/`handleRemoveMember` as TODOs that just `toast.info("Member management coming soon")` — while the backend endpoints (change-role, remove-member, leave) have existed since L6. Pure frontend wiring. The file's ~10 unused imports are the leftovers of that stub and should go with it. |
| L21 | ✅ **Clear the TypeScript and lint backlog** | `tsc -b` is at **0 errors** (was 22) and `biome check` exits 0. The interesting ones weren't the dead imports: (1) four endpoints (`add-project-member`, `change-project-member-role`, `create-project-task`, `update-project-task`) ran a `ValidationFilter` but never declared `.Produces<ValidationErrors>(422)`, so the generated client's error union was missing the validation case and code handling `error.errors` couldn't typecheck — the **contract** was wrong, not the frontend; fixing it surfaced a further unhandled union in `members-list.tsx`. (2) `calendar.tsx` used react-day-picker's pre-v10 `table` class key (now `month_grid`). (3) React 19 dropped the global `JSX` namespace (`React.JSX.Element`). (4) `App.tsx`/`App.css` were unreferenced Vite scaffold — deleted. For Biome: first-party a11y errors fixed properly (anchors that were really buttons, a click-only `<div>`, `==` on `number \| string` ids, `<label>` on composite groups, a `<video>` with no caption track); vendored shadcn `components/ui/**` gets a scoped rule override in `biome.json` rather than diverging from upstream, matching the existing precedent of excluding generated code. |
| L22 | ✅ **Widen test coverage** | Backend **43 tests** (was 28, one of which was failing). Fixed that failure first: `ValidationFilterTests` asserted PascalCase error paths, but `ValidationFilter.cs:36` camel-cases them so they match the JSON the SPA consumes — the test's expectation was wrong, not the code. Added `ProjectPermissionsTests` covering the role→permission matrix that `RequireProjectPermissionFilter` reads for *every* project endpoint: the exact set per role, `HasPermission`/`GetPermissions` agreement, owner-only permissions held by nobody else, and two structural guards — every role has an entry (a missing one falls through to "no permissions" silently) and permissions widen strictly up the hierarchy. Frontend gains **42 tests** via `bun test` (built in, no new runner dependency): `toolbar-filters` (search across name/description/tags, each filter, AND-combination, due-bucket day boundaries at ±0/7/8, all five sorts, no-mutation), `use-drag-n-drop`'s `scoreBetween`/`columnScoreBetween` — including an explicit test that their open-ended cases are *mirror images*, which is the bug you'd get by copying one into the other — and `grouping` (all three non-column groupings, multi-assignee duplication, empty-group hiding, string/number id coercion). Still uncovered: the endpoint handlers themselves. |
| L23 | ✅ **First deploy** | **Live in production** — account creation, email confirmation and the app itself verified end to end by hand. Getting there took three fixes beyond the container itself, all found by deploying rather than by reading: the compose service never joined `dokploy-network` so Traefik never discovered it (an undiscovered service gets *404*, not 502, which is why it read as a broken SPA fallback for so long); the runtime image ships no `wget`/`curl`, so the healthcheck could never pass; and no `Resend` section existed in any appsettings file, so `From` would have been empty and no account could ever have been confirmed. README is still not written — that part of this task remains. |

---

## Phase 3 — Personal task management (no deadline)

**Goal:** Make it good for the "daily life" half of the use case, not just the "dev project"
half. Today every task must live inside a project, in a column, on a board — which is heavy
for *"buy milk"*.

| # | Task | Notes |
|---|------|-------|
| L24 | **Inbox / quick capture** | The sidebar already links to `/inbox` and the route doesn't exist. A default landing place for tasks captured without deciding a project or column yet, plus a fast "add task" affordance reachable from anywhere (keyboard shortcut). Needs a decision: a real per-user Inbox project created on registration, or a nullable `RelatedProjectId` on `ProjectTask` — the former is much less invasive given how much of the schema and RBAC assumes a project. |
| L25 | **Recurring tasks** | Daily/weekly/monthly repeats for the life-admin use case. Schema and completion semantics both need thought: does completing an instance spawn the next one, or is the series virtual and materialized on read? |
| L26 | **Sub-tasks / checklists** | A self-referencing parent on `ProjectTask`, or a lighter embedded checklist. Checklists are enough for most real use and avoid recursive queries, permissions and drag-and-drop implications — worth resisting full nesting unless it's actually needed. |
| L27 | **Personal views: Today / Upcoming** | Built on L16's cross-project query. "What do I have to do today" is the question the app should answer on open, and it currently can't answer it at all. |
| L28 | **Calendar view** | Sidebar links to `/calendar`, route doesn't exist. Month/week grid of tasks by due date, ideally with drag-to-reschedule reusing the existing score/move plumbing conceptually (though dates, not scores, are what change). |
| L29 | **Trash / soft delete** | Sidebar links to `/trash`, route doesn't exist. Deletes are currently hard — a `DeletedAt` column plus a restore window, and a global query filter so every existing query excludes trashed rows without being individually rewritten. |

---

## Phase 4 — Collaboration (no deadline)

**Goal:** Make multi-person projects genuinely workable rather than just permitted.

| # | Task | Notes |
|---|------|-------|
| L30 | **Task comments** | The most obviously missing collaboration primitive — the data model has no comment entity at all. New `Features/TaskComments/` slice, with markdown bodies (the frontend already renders markdown for descriptions via `react-markdown`). |
| L31 | **Activity log / audit trail** | Who moved what, when. Entities already carry `CreatedAt`/`UpdatedAt` via `IAuditable` and the `SaveChangesAsync` override, but nothing records *transitions* — the interesting part for a shared board. |
| L32 | **Notifications** | Assigned to a task, mentioned in a comment, due date approaching. In-app first (a bell + unread count), email digest second — the Resend integration from L4 is already there for the email half. |
| L33 | **Real-time board updates** | Two people on one board today will silently overwrite each other's optimistic state. SignalR pushing column/task move events, with the client reconciling against the same score-based ordering it already uses. Worth doing after L31, since an activity stream and a realtime feed want the same event shape. |
| L34 | **@mentions** | Depends on L30 and L32. |

---

## Phase 5 — Power features (no deadline)

**Goal:** Speed and scale for someone whose whole life is in here.

| # | Task | Notes |
|---|------|-------|
| L35 | **Global search** | Sidebar links to `/search`, route doesn't exist. Across tasks, projects, comments. SQLite FTS5 is the natural fit and avoids adding a search service — worth confirming EF Core can reach it cleanly before committing. |
| L36 | **Keyboard-first navigation** | Command palette (⌘K), shortcuts for capture/complete/navigate. The single biggest daily-driver quality-of-life feature and cheap relative to its impact. |
| L37 | **Saved views / filters** | The Phase 1 toolbar state (`ToolbarState` in `toolbar-filters.ts`) is in-memory and resets on reload. Persist named filter sets per user, and put the active one in the URL so views are shareable — the route already has a `view` search param to extend. |
| L38 | **Bulk operations** | Multi-select tasks, then move/assign/tag/delete in one action. |
| L39 | **Import / export** | Get data out (JSON, CSV) and in (Todoist, Trello). Also the honest backup story for a self-hosted app, complementing L23's file-level backups. |
| L40 | **Custom fields** | Per-project user-defined fields. Deliberately late: it's a schema-design commitment that's painful to reverse, and most of its value is covered by tags plus priority until proven otherwise. |

---

## Phase 6 — AI assistance (no deadline)

**Goal:** The `/ask-ai` entry already sitting in `sidebar-config.ts`, made real.

Worth being disciplined here: the value is in *reducing capture friction*, not in a chatbot.
Natural-language capture (L41) is the feature that earns its place; the rest are speculative
until the app has enough real data in it to be worth summarizing.

| # | Task | Notes |
|---|------|-------|
| L41 | **Natural-language task capture** | *"remind me to email the professor next Tuesday"* → a task with a parsed due date, project guess and priority. Pairs directly with L24's quick capture and is the highest-value AI surface by a wide margin. |
| L42 | **Ask-AI over your own tasks** | Sidebar route `/ask-ai` doesn't exist. "What's overdue?", "What did I do last week?" — answered against the user's own data. Depends on L16. |
| L43 | **Summarization** | Project status digests, standup notes from the L31 activity log. |
| L44 | **Smart suggestions** | Priority and due-date suggestions from historical patterns. Deliberately last — needs real usage data to be anything other than noise. |

---

## Phase 7 — Reach & polish (no deadline)

**Goal:** Available everywhere, pleasant everywhere.

| # | Task | Notes |
|---|------|-------|
| L45 | **PWA + offline** | Installable, with offline reads and queued mutations. The React Query cache is already the right shape for this; the hard part is reconciling queued moves against server-side scores that may have shifted. |
| L46 | **Mobile-responsive board** | The Kanban board assumes a wide viewport and pointer-based drag. Touch drag and a narrow-screen layout are a real piece of work, not a media query. |
| L47 | **Theming** | `next-themes` and the shadcn CSS variables are already in place; per-project accent colors and a proper dark-mode audit are what's left. |
| L48 | **Onboarding** | First-run experience: a sample project, an empty-state that teaches instead of sitting blank. |
| L49 | **Performance pass** | Response compression is done (brotli/gzip via `UseResponseCompression`, measured 600KB → 176KB on the largest chunk). What's left: the `$projectId` route chunk is still ~600KB raw — by far the largest — so the win now is in what that one route pulls in, not in more compression. Also worth precompressing assets at build time rather than per request: they are immutable (hashed filenames) yet get recompressed on every hit, and build-time brotli `SmallestSize` reaches 149KB, which is unaffordable at request time (560ms). Needs content-negotiating static file middleware, which ASP.NET has no built-in for. Also virtualize long task lists. |
| L50 | **Store due dates as UTC `DateTime`, not `DateTimeOffset`** | SQLite has no date type: EF stores a `DateTimeOffset` as text like `2026-07-02 22:00:00+00:00`. Ordering by one **throws** (`NotSupportedException`), and comparing one in a `WHERE` silently degrades to a *text* comparison that is only correct while every row happens to carry the same offset — true of today's data by luck (the SPA sends `toISOString()`), not by construction. `GET /api/tasks` therefore does its due-date filtering and sorting in memory, which also means its `limit` bounds the response but not the query. A value converter to UTC `DateTime` on `ProjectTask.DueDate`/`StartDate` and `Project.StartDate`/`DueDate` pushes all of it back into SQL. Needs a migration that **rewrites existing values**, not just the column type: SQLite is dynamically typed, so a plain rebuild would leave `+00:00` text sitting in a column EF now reads as `DateTime`. |
| L51 | **Server-side dashboard counts** | The dashboard's stat tiles are computed from the task list it already fetched, capped at the endpoint's 200-row ceiling — past that the counts silently understate. Cheap to fix (`GROUP BY` on the due-date bucket) but pointless before L50, since bucketing by date is the thing SQLite can't currently do. |

---

## Status at a glance

```
Phase 1  Foundations              ██████████  12/12  done
Phase 2  Deployable MVP           ████████░░  10/13  <- current focus
Phase 3  Personal task management ░░░░░░░░░░   0/6
Phase 4  Collaboration            ░░░░░░░░░░   0/5
Phase 5  Power features           ░░░░░░░░░░   0/6
Phase 6  AI assistance            ░░░░░░░░░░   0/4
Phase 7  Reach & polish           ░░░░░░░░░░   0/7
```

The deploy spine (L17 → L18 → L19 → L19.5) is built: a push to `main` builds the image, pushes
it to GHCR and pokes Dokploy. The image runs and migrates cleanly from an empty volume.

**Shipped.** The app is live, an account has been created and confirmed against it, and a push
to `main` now builds, pushes to GHCR and redeploys on its own.

**Next three, in order:** L15.5 (not-found redirect — `/dashboard` is now worth landing on) →
L20 (member management UI, whose endpoints have existed since Phase 1) → L50 (the
`DateTimeOffset` storage fix, which L16 worked around rather than solved and which L51 and any
future date filter both wait on). L14, L22's remaining coverage and L23's README are the
cleanup tail.
