# Blitz Task

A self-hosted task and project manager — Kanban board and table view, built to cover work,
school, side projects and daily life in one place instead of three apps.

Single maintainer, running in production, actively built. If you want to know where it is
going, [ROADMAP.md](ROADMAP.md) is honest about what exists and what does not.

## What it does today

- **Projects** with a drag-and-drop Kanban board and an equivalent table view, sharing one
  ordering model — filters, sort and grouping apply to both.
- **Tasks** with priority, tags, start/due dates, multiple assignees and file attachments.
- **Cross-project dashboard** — what is overdue, what is due today, what is next, across
  every project you belong to.
- **Sharing** — invite by email, four roles (Owner / Collaborator / Contributor / Viewer)
  with per-project permissions.
- **Accounts** — registration, email confirmation, password reset, cookie auth with CSRF
  protection.

Not there yet: recurring tasks, reminders, a calendar view, comments, search, notifications.
Those are Phases 3–5 of the roadmap.

## Stack

One deployable unit — the backend serves the built frontend, so there is no separate
frontend host.

| | |
|---|---|
| Backend | ASP.NET Core 10 minimal API, EF Core, **SQLite** |
| Frontend | React 19, TypeScript, Vite, TanStack Router/Query/Table, Tailwind v4, shadcn/ui |
| Tooling | Biome (not ESLint/Prettier), bun, xUnit |
| Deploy | Docker image on GHCR, Dokploy + Traefik on a VPS |

SQLite is a deliberate choice, not a placeholder: a single-user-to-small-team self-hosted app
has no need for a second container to babysit, and it makes the whole app one file to back up.

## Self-hosting

The image is built by CI and published to GHCR, so nothing is compiled on the host.

```bash
curl -O https://raw.githubusercontent.com/LinkNexus/blitz-task/main/docker-compose.yml
# set the required variables below, then:
docker compose up -d
```

The app listens on port 8080 inside the container and expects a reverse proxy in front of it
for TLS.

### Configuration

| Variable | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | **yes** | Email delivery. Read directly from the environment, not from a config section. |
| `Resend__FromEmail` | **yes** | Must be a domain verified in Resend. |
| `Resend__FromName` | no | Defaults to `BlitzTask`. |
| `App__BaseUrl` | **yes** | Public origin, e.g. `https://tasks.example.com`. Emailed links are built from it, and reminders are sent by a background job with no request to infer it from. |
| `ConnectionStrings__DefaultConnection` | no | Defaults to `Data Source=Data/blitz-task.db`. |

`__` is ASP.NET's separator for nested configuration, so `Resend__FromEmail` sets the
`FromEmail` key of the `Resend` section. The compose file declares the required ones with
`:?`, so a misconfigured deploy fails loudly instead of starting half-broken — which matters,
because email is not optional here: account confirmation gates almost every endpoint, so
without working mail nobody can get past registration.

### Back these up

Three paths hold everything, and the compose file puts the first two on named volumes:

- `Data/blitz-task.db` — the database.
- `Uploads/` — attachments and project images.
- `Data/DataProtection-Keys/` — the key ring that signs auth cookies and CSRF tokens. Losing
  it does not lose data, but it logs every user out and invalidates their antiforgery tokens
  on every redeploy.

Migrations are applied automatically on startup, so upgrading is a pull and a restart.

## Development

Requires .NET 10 SDK and [bun](https://bun.sh).

```bash
# backend — http://localhost:5121
dotnet run --project server/BlitzTask.Backend

# frontend — http://localhost:5173, proxies /api to the backend
cd web && bun install && bun run dev
```

Email in development goes to SMTP on `localhost:1025` rather than Resend, so run a catcher
such as [Mailpit](https://mailpit.axllent.org/) — without one, registration cannot complete.

```bash
dotnet test server/BlitzTask.Backend.Tests   # backend
cd web && bun test                           # frontend
bunx biome check .                           # lint + format, repo root
```

### Two things that will confuse you otherwise

**The API client is generated, and the build order matters.** `web/src/api/**` is gitignored
and produced by `@hey-api/openapi-ts` from an OpenAPI document that the *backend build*
emits. Change a C# endpoint and the chain is:

```
dotnet build server/BlitzTask.Backend   # rewrites BlitzTask.Backend.json
cd web && bun run api:gen               # rewrites src/api/**
```

**Typecheck with `tsc -b`, never `tsc --noEmit`.** `web/tsconfig.json` is solution-style with
`"files": []`, so `--noEmit` compiles nothing and cheerfully exits 0 on a broken app. And
`tsc -b` needs a build first, because the route tree (`src/routeTree.gen.ts`) is gitignored
and emitted by the router's Vite plugin — on a fresh clone, run `bun run build` before
typechecking or you get ~22 phantom errors.

Contributors: run `git config core.hooksPath .githooks` once. It refuses commits on `main`,
staying out of the way during merges and rebases.

[CLAUDE.md](CLAUDE.md) documents the architecture and the non-obvious constraints in more
depth — it is written for AI agents but is the most accurate description of how the code
fits together.
