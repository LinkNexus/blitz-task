# syntax=docker/dockerfile:1

# The build order here is not arbitrary. web/src/api/** is generated (and gitignored),
# produced by openapi-ts from server/BlitzTask.Backend/BlitzTask.Backend.json — which the
# backend build emits. So: build the backend first, generate the client, then build the SPA.

# ---- 1. Backend build: also emits the OpenAPI document the frontend needs ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY server/BlitzTask.Backend/BlitzTask.Backend.csproj server/BlitzTask.Backend/
RUN dotnet restore server/BlitzTask.Backend/BlitzTask.Backend.csproj
COPY server/ server/
RUN dotnet build server/BlitzTask.Backend/BlitzTask.Backend.csproj -c Release --no-restore

# ---- 2. Frontend build: generates the typed client, then bundles ----
FROM oven/bun:1 AS frontend-build
WORKDIR /src
COPY web/package.json web/bun.lock web/
RUN cd web && bun install --frozen-lockfile
COPY web/ web/
# openapi-ts reads ../server/BlitzTask.Backend/BlitzTask.Backend.json, so the document has to
# sit at that exact path relative to web/.
COPY --from=backend-build /src/server/BlitzTask.Backend/BlitzTask.Backend.json server/BlitzTask.Backend/
RUN cd web && bun run api:gen
# vite.config.ts writes to ../server/BlitzTask.Backend/wwwroot
RUN cd web && bun run build

# ---- 3. Backend publish ----
FROM backend-build AS publish
RUN dotnet publish server/BlitzTask.Backend/BlitzTask.Backend.csproj \
    -c Release --no-build -o /app/publish

# ---- 4. Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# RazorLight resolves email templates against the working directory, so WORKDIR must stay
# /app — the templates land at /app/Templates/Email via the csproj Content rule.
COPY --from=publish /app/publish ./
COPY --from=frontend-build /src/server/BlitzTask.Backend/wwwroot ./wwwroot

# Both are relative paths in appsettings.json (Data Source=Data/..., UploadDirectory=Uploads)
# and resolve against WORKDIR. Mount volumes here or a redeploy discards all data.
RUN mkdir -p Data Uploads
VOLUME ["/app/Data", "/app/Uploads"]

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "BlitzTask.Backend.dll"]
