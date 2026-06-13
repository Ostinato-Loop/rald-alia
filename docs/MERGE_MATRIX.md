# RALD ALIA — Repository Consolidation Merge Matrix
**Date:** 2026-06-13  
**Directive:** ALIA Phase 1 — P0 Repository Consolidation  
**Decision:** GitHub `Ostinato-Loop/rald-alia` is canonical. GitLab `sekanidev/rald-alia` → archived after merge.

---

## Summary

| Source | Services | Dockerfiles | Docker Compose | CI/CD | Frontend | API Spec | Engines |
|--------|----------|-------------|----------------|-------|----------|----------|---------|
| GitHub `rald-alia` | 11 | ❌ NONE | ❌ | ❌ | ❌ | ❌ | ✅ M0–M6 complete |
| GitLab `rald-alia` | 14 | ✅ ALL | ✅ | ✅ | ✅ 4 apps | ✅ OpenAPI 3.1 | Partial (M0–M3 only) |

**Rule:** GitHub wins on engine/schema completeness. GitLab wins on infrastructure and frontend. Merge GitLab infra into GitHub.

---

## Service Inventory

### Services ONLY in GitHub → Keep as-is

| Service | Port | M-Status | Notes |
|---------|------|----------|-------|
| `control-plane` | 3006 | ❌ M10 not started | Just scaffolded today |
| `institution-service` | varies | ✅ M5 complete | Banks, fintechs, mobile money, PSBs |
| `registry-service` | 3006 | ✅ M2 complete | 7-dimension entity model, Kafka hooks |

**Action:** Add Dockerfiles from template. Add to docker-compose.

---

### Services ONLY in GitLab → Port to GitHub

| Service | Port | Priority | What it does |
|---------|------|----------|--------------|
| `alias-service` | 3002 | **P0** | Alias CRUD (email/phone/username/handle) |
| `directory-service` | 3003 | **P0** | Public alias directory (cached, read-optimised) |
| `routing-service` | 3005 | **P0** | Payment routing profiles, multi-bank routing |
| `audit-service` | 3007 | P1 | Immutable audit logs |
| `notification-service` | 3008 | P1 | Email/SMS/webhook notifications |
| `fraud-service` | 3006 | P1 | Risk scoring, velocity checks |
| `gateway` | 3000 | P1 | API gateway/proxy for internal routing |

**Action:** Copy src/, package.json, tsconfig.json, Dockerfile from GitLab into GitHub. Add to docker-compose.

---

### Services in BOTH → GitHub version is canonical (newer engines)

| Service | GitHub Status | GitLab Status | Decision |
|---------|--------------|---------------|----------|
| `consent-service` | M1 ConsentEngine ✅ | Basic CRUD | **Keep GitHub** |
| `governance-service` | M6 CountryRulesEngine ✅ | Older | **Keep GitHub** |
| `identity-service` | M3 StateMachine + M4 MachineJWT ✅ | M0-M2 only | **Keep GitHub** |
| `merchant-service` | M1 MerchantEngine ✅ | Basic | **Keep GitHub** |
| `resolution-engine` | M1 full engine ✅ | Basic | **Keep GitHub** |
| `trust-service` | M1 TrustScoreEngine ✅ | Basic | **Keep GitHub** |
| `verification-service` | M1 KYCEngine ✅ | Basic | **Keep GitHub** |

**Action:** Add Dockerfiles from GitLab pattern. Keep GitHub src code.

---

## Packages

### Port from GitLab → GitHub: `packages/kafka`

GitLab has `packages/kafka` — a Kafka producer/consumer wrapper (`@rald-alia/kafka`). GitHub has `packages/db`, `packages/sdk`, `packages/shared` but NO Kafka package.

**Action:** Port `packages/kafka` from GitLab into GitHub.

---

## Infrastructure to Port (GitLab → GitHub)

### 1. Dockerfiles
Port the multi-stage Dockerfile pattern from GitLab. Apply to ALL 18 services.

```dockerfile
# Pattern from GitLab identity-service Dockerfile:
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/kafka ./packages/kafka
COPY packages/db ./packages/db
COPY services/<service-name> ./services/<service-name>
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rald-alia/shared build
RUN pnpm --filter @rald-alia/kafka build
RUN pnpm --filter @rald-alia/db build
RUN pnpm --filter @rald-alia/<service-name> build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/<service-name>/dist ./dist
COPY --from=builder /app/services/<service-name>/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE <PORT>
CMD ["node", "dist/index.js"]
```

### 2. docker-compose.yml
Merge both docker-compose files into a canonical version with ALL 18 services.
→ See `alia-work/P0-infra/docker-compose.yml`

### 3. CI/CD Pipeline
Convert `.gitlab-ci.yml` to GitHub Actions.
→ See `alia-work/P0-infra/.github/workflows/ci.yml`

### 4. OpenAPI Specification
Port `lib/api-spec/openapi.yaml` → `docs/openapi.yaml` in GitHub.

### 5. Frontend Applications
Port `frontend/apps/` (4 Next.js apps) into GitHub monorepo:
- `admin-console` → `frontend/apps/admin-console`
- `bank-dashboard` → `frontend/apps/bank-dashboard`
- `developer-console` → `frontend/apps/developer-console`
- `marketing-site` → `frontend/apps/marketing-site`

### 6. Client Libraries
Port `lib/api-zod` and `lib/api-client-react` into GitHub.

### 7. Scripts
Port `scripts/` directory.

---

## Final Service Port Map (Canonical GitHub)

| Service | Port | GitHub Src | Docker | Kafka |
|---------|------|-----------|--------|-------|
| `identity-service` | 3001 | ✅ GitHub | ⬆️ Port | ✅ |
| `alias-service` | 3002 | ⬆️ Port GitLab | ⬆️ Port | ✅ |
| `directory-service` | 3003 | ⬆️ Port GitLab | ⬆️ Port | - |
| `resolution-engine` | 3004 | ✅ GitHub | ⬆️ Port | ✅ |
| `routing-service` | 3005 | ⬆️ Port GitLab | ⬆️ Port | - |
| `fraud-service` | 3006 | ⬆️ Port GitLab | ⬆️ Port | ✅ |
| `audit-service` | 3007 | ⬆️ Port GitLab | ⬆️ Port | ✅ |
| `notification-service` | 3008 | ⬆️ Port GitLab | ⬆️ Port | ✅ |
| `governance-service` | 3009 | ✅ GitHub | ⬆️ Port | ✅ |
| `consent-service` | 3010 | ✅ GitHub | ⬆️ Port | ✅ |
| `trust-service` | 3011 | ✅ GitHub | ⬆️ Port | ✅ |
| `merchant-service` | 3012 | ✅ GitHub | ⬆️ Port | ✅ |
| `verification-service` | 3013 | ✅ GitHub | ⬆️ Port | ✅ |
| `institution-service` | 3014 | ✅ GitHub | ⬆️ Write | ✅ |
| `registry-service` | 3015 | ✅ GitHub | ⬆️ Write | ✅ |
| `gateway` | 3000 | ⬆️ Port GitLab | ⬆️ Port | - |
| `developer-service` | 3016 | ✅ GitHub (stub) | ⬆️ Write | - |
| `control-plane` | 3017 | ✅ GitHub (stub) | ⬆️ Write | - |

---

## Migration Steps (ordered)

```
Step 1  Clone GitLab repo locally (git clone with GITLAB_ACCESS_TOKEN)
Step 2  Copy GitLab-only services into GitHub monorepo
          alias-service, directory-service, routing-service,
          audit-service, notification-service, fraud-service, gateway
Step 3  Copy packages/kafka from GitLab
Step 4  Write Dockerfiles for all 18 services (from template)
Step 5  Commit merged docker-compose.yml + docker-compose.dev.yml
Step 6  Add .github/workflows/ci.yml (converted from .gitlab-ci.yml)
Step 7  Copy docs/openapi.yaml (from GitLab lib/api-spec)
Step 8  Copy frontend/apps/* (4 Next.js apps)
Step 9  Push all to GitHub main
Step 10 Archive GitLab repo (Settings → Archive project)
```

---

## What rald-routing (Cloudflare Worker) is vs ALIA backend

Important distinction for the architecture:

| | `rald-routing` (CF Worker) | ALIA `resolution-engine` (Node.js) |
|---|---|---|
| **Location** | Cloudflare Edge (routing.rald.cloud) | Docker/ECS (internal) |
| **Role** | Routes RALD users to the correct ALIA instance | Resolves alias → bank routing token |
| **Caller** | RALD apps (Loop, Messenger, etc.) | rald-routing or institution integrations |
| **Auth** | RALD JWT | Machine JWT |
| **State** | Stateless | PostgreSQL + Redis |

These are two different layers. `rald-routing` is the public edge; `resolution-engine` is the internal resolver. Both are needed. Both already have code.
