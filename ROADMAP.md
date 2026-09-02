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

The blockers are unglamorous and mostly infrastructural. Two of them (L13, L15) are hard
blockers for "usable at all": today you can create a project and then have **no way to
navigate back to it** — the sidebar has only a "Create Project" button and there is no
list endpoint behind it.

| # | Task | Notes |
|---|------|-------|
| L13 | **`GET /api/projects` — list the current user's projects** | Does not exist today; only `GET /api/projects/{id}` does. Needs to return projects the user participates in (join through `ProjectParticipant`), with enough for a list row: name, image, role, member count, task counts. This is the single highest-value missing endpoint — without it the app is a one-way trip into a project you can only reach by typing its URL. |
| L14 | **Reverse-proxy correctness** | Email links are built from `context.Request.Scheme`/`Host` (`AuthEndpoints.cs:233,415`, `ProjectMembersEndpoints.cs:135`). Behind a proxy that terminates TLS these come out as `http://` and/or the internal host, so confirmation and invitation links break in production. Needs `UseForwardedHeaders` with `XForwardedFor|XForwardedProto` and a known-proxy config, plus `UseHttpsRedirection`/`UseHsts` outside Development. None of these are wired today. |
| L15 | **Real dashboard** | `routes/_app/dashboard.tsx` is literally `<div>Hello "/_authenticated/dashboard"!</div>` — it is the post-login landing page. Needs: project list (from L13), tasks assigned to me across all projects, what's due today/overdue. Depends on L13 and, for the cross-project query, L16. |
| L16 | **Cross-project task query endpoint** | Every task endpoint today is scoped `/api/{projectId}/tasks/...`. A dashboard, an inbox and a calendar all need "my tasks across all projects, filtered by due date / assignee". One new endpoint unblocks three surfaces — worth designing its filter/paging shape carefully rather than adding three narrow ones later. |
| L17 | ✅ **Apply migrations at startup** | `Program.cs` now runs `dbContext.Database.Migrate()` in a scope right after `builder.Build()`, and creates the SQLite data directory first (SQLite will not create one, and a fresh deploy mounts an empty volume). The uploads directory is created the same way from `FileUploadSettings.UploadDirectory`. Verified: a container started against an empty volume applies all 6 migrations and serves traffic. |
| L18 | ✅ **Dockerfile + compose** | Four-stage build, and the stage order is forced rather than stylistic: `web/src/api/**` is gitignored and generated by openapi-ts from `BlitzTask.Backend.json`, which the **backend build emits** — so backend build → `api:gen` → `vite build` → publish → runtime. Two bugs found and fixed by actually running the image: (1) the Razor SDK compiles `.cshtml` into the assembly and **strips it from publish output**, so RazorLight found no email templates in the container — fixed by taking `Templates/**` away from the Razor SDK entirely (`Content Remove` + `None Include` with `CopyToPublishDirectory`); (2) Data Protection keys defaulted to `/root/.aspnet/DataProtection-Keys`, outside any volume — every redeploy would have silently logged out every user and started rejecting their antiforgery tokens. Now persisted to `Data/DataProtection-Keys` with `SetApplicationName`, verified to survive container replacement. `docker-compose.yml` targets Dokploy Compose mode against the GHCR image, with named volumes for `/app/Data` and `/app/Uploads`. Image is 487MB. |
| L19 | ✅ **CI: build, test, lint on every push and PR** | `.github/workflows/ci-cd.yml`. `backend` job runs `dotnet build`/`dotnet test` on the `.slnx` and uploads `BlitzTask.Backend.json` as an artifact; `frontend` job downloads it, runs `api:gen`, `tsc -b`, `bun test`, `vite build` and `biome check`. The artifact hop is not incidental — the frontend genuinely cannot typecheck without a backend build. Every step **gates** (no `continue-on-error`) now that L21/L22 have cleared the backlog. |
| L19.5 | ✅ **CD: build image → GHCR → Dokploy webhook** | Same workflow, `deploy` job gated on `github.ref == 'refs/heads/main' && github.event_name == 'push'` and `needs: [backend, frontend]` — one workflow rather than two so the gate is a real dependency instead of `workflow_run`, which fires regardless of the first workflow's conclusion. Pushes to `ghcr.io/linknexus/blitz-task` with `latest` + long SHA tags via `docker/metadata-action` (which also lowercases the repo name — ghcr rejects uppercase), authenticating with the workflow's own `GITHUB_TOKEN` under `packages: write`, so there is no registry PAT to rotate. Layer cache via `type=gha`. Finally POSTs `secrets.DOKPLOY_WEBHOOK_URL` (mapped to env first — the `secrets` context is not available in `if:` expressions). **Unverified until the first push to `main`**: the image builds and runs locally, but the GHCR push, the webhook and Dokploy's pull have never executed. Remember the webhook returns 200 for accepting the trigger, not for a successful pull — if the GHCR package is private, Dokploy needs registry credentials or the pull fails silently behind a green pipeline. |
| L20 | **Finish member management UI** | `project-members/index.tsx` has `handleChangeRole`/`handleRemoveMember` as TODOs that just `toast.info("Member management coming soon")` — while the backend endpoints (change-role, remove-member, leave) have existed since L6. Pure frontend wiring. The file's ~10 unused imports are the leftovers of that stub and should go with it. |
| L21 | ✅ **Clear the TypeScript and lint backlog** | `tsc -b` is at **0 errors** (was 22) and `biome check` exits 0. The interesting ones weren't the dead imports: (1) four endpoints (`add-project-member`, `change-project-member-role`, `create-project-task`, `update-project-task`) ran a `ValidationFilter` but never declared `.Produces<ValidationErrors>(422)`, so the generated client's error union was missing the validation case and code handling `error.errors` couldn't typecheck — the **contract** was wrong, not the frontend; fixing it surfaced a further unhandled union in `members-list.tsx`. (2) `calendar.tsx` used react-day-picker's pre-v10 `table` class key (now `month_grid`). (3) React 19 dropped the global `JSX` namespace (`React.JSX.Element`). (4) `App.tsx`/`App.css` were unreferenced Vite scaffold — deleted. For Biome: first-party a11y errors fixed properly (anchors that were really buttons, a click-only `<div>`, `==` on `number \| string` ids, `<label>` on composite groups, a `<video>` with no caption track); vendored shadcn `components/ui/**` gets a scoped rule override in `biome.json` rather than diverging from upstream, matching the existing precedent of excluding generated code. |
| L22 | ✅ **Widen test coverage** | Backend **43 tests** (was 28, one of which was failing). Fixed that failure first: `ValidationFilterTests` asserted PascalCase error paths, but `ValidationFilter.cs:36` camel-cases them so they match the JSON the SPA consumes — the test's expectation was wrong, not the code. Added `ProjectPermissionsTests` covering the role→permission matrix that `RequireProjectPermissionFilter` reads for *every* project endpoint: the exact set per role, `HasPermission`/`GetPermissions` agreement, owner-only permissions held by nobody else, and two structural guards — every role has an entry (a missing one falls through to "no permissions" silently) and permissions widen strictly up the hierarchy. Frontend gains **42 tests** via `bun test` (built in, no new runner dependency): `toolbar-filters` (search across name/description/tags, each filter, AND-combination, due-bucket day boundaries at ±0/7/8, all five sorts, no-mutation), `use-drag-n-drop`'s `scoreBetween`/`columnScoreBetween` — including an explicit test that their open-ended cases are *mirror images*, which is the bug you'd get by copying one into the other — and `grouping` (all three non-column groupings, multi-assignee duplication, empty-group hiding, string/number id coercion). Still uncovered: the endpoint handlers themselves. |
| L23 | **README + first deploy** | No README exists. Needs setup, env vars (`RESEND_API_KEY`, connection string, `ASPNETCORE_ENVIRONMENT`), and the migration/build steps. Then actually deploy it — VPS with the compose file from L18 behind a reverse proxy, TLS, and a backup story for the SQLite file and `Uploads/` (a nightly copy off-box is enough at this scale). |

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
| L49 | **Performance pass** | The `$projectId` route bundle is already ~600KB (the largest chunk by a wide margin). Route-level code splitting is on, so this is mostly about what that one route pulls in. Also virtualize long task lists. |

---

## Status at a glance

```
Phase 1  Foundations              ██████████  12/12  done
Phase 2  Deployable MVP           █████░░░░░   6/12  <- current focus
Phase 3  Personal task management ░░░░░░░░░░   0/6
Phase 4  Collaboration            ░░░░░░░░░░   0/5
Phase 5  Power features           ░░░░░░░░░░   0/6
Phase 6  AI assistance            ░░░░░░░░░░   0/4
Phase 7  Reach & polish           ░░░░░░░░░░   0/5
```

The deploy spine (L17 → L18 → L19 → L19.5) is built: a push to `main` builds the image, pushes
it to GHCR and pokes Dokploy. The image runs and migrates cleanly from an empty volume.

**Next three, in order:** L23 (first real deploy — proves L19.5 end to end) → L13 (project
list endpoint) → L15 (dashboard). L13 and L15 are what turn the app from "a board you can only
reach by URL" into something navigable; L23 comes first only because the pipeline's untested
half is worth closing while it's fresh. L14 and L20 are the remaining Phase 2 items after that.
