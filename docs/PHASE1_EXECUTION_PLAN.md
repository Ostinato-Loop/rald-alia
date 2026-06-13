# RALD ALIA — Phase 1 Execution Plan
**Date:** 2026-06-13  
**Owner:** LILCKY STUDIO LIMITED  
**Engineer-in-charge:** Principal Engineer (RALD ALIA Network)

---

## Current State

| Item | Status |
|------|--------|
| GitHub `rald-alia` | 11 services, M0–M6 complete, NO infra, committed today |
| GitLab `rald-alia` | 14 services, Dockerfiles, Docker Compose, 4 frontends, CI/CD, last active 2026-06-11 |
| `rald-routing` CF Worker | Live skeleton at routing.rald.cloud, partial — routes to ALIA instances |
| AWS infrastructure | Not provisioned |
| Any service deployed | No |

---

## Deliverables Produced (This Session)

### P0 — Repository Consolidation

| File | Purpose |
|------|---------|
| `reports/ALIA_MERGE_MATRIX.md` | Complete audit: what's in GitHub vs GitLab, service-by-service decision |
| `alia-work/P0-infra/docker-compose.yml` | Canonical merged compose — all 16 services + Postgres + Redis + Kafka + Kafka UI |
| `alia-work/P0-infra/docker-compose.dev.yml` | Dev override — adds Kafka UI, pgAdmin, RedisInsight |
| `alia-work/P0-infra/.env.example` | Environment variable template |
| `alia-work/P0-infra/Dockerfile.template` | Standard multi-stage build pattern |
| `alia-work/P0-infra/.github/workflows/ci.yml` | GitHub Actions: install → typecheck → build → test → docker → deploy (dev/staging/prod) |
| `alia-work/P0-infra/scripts/port-from-gitlab.sh` | One-command GitLab → GitHub port script |
| `alia-work/P0-infra/scripts/generate-dockerfiles.sh` | Generates Dockerfiles for all 18 services |

### P1 — AWS Infrastructure (Terraform)

| Module | Resources |
|--------|-----------|
| `modules/vpc` | VPC, 3x public/private/isolated subnets, NAT gateways (1/AZ), IGW, route tables, VPC Flow Logs |
| `modules/security` | 5x Security Groups (ALB/ECS/RDS/Redis/Kafka), IAM roles (ECS execution + task), 5x Secrets Manager secrets, WAF WebACL (OWASP + KnownBadInputs + Rate limit 2000 req/IP) |
| `modules/rds` | RDS PostgreSQL 16, Multi-AZ (prod), encrypted, enhanced monitoring, Performance Insights, auto-minor-upgrade, DB URL → Secrets Manager |
| `modules/redis` | ElastiCache Redis 7, TLS + auth token, automatic failover (prod), LRU eviction, Redis URL → Secrets Manager |
| `modules/kafka` | MSK Kafka 3.6, 3 brokers, 18 ALIA topics (production), CloudWatch logs, Prometheus metrics |
| `modules/alb` | ALB, HTTP→HTTPS redirect, TLS 1.3, WAF association, 16x target groups, S3 access logs |
| `modules/ecs` | ECS Fargate cluster, 16x ECR repos, 16x task definitions, 16x services, Container Insights, auto-scaling (prod), circuit breaker + rollback |
| `modules/monitoring` | CloudWatch dashboard (all services + ALB + RDS + Redis), CPU/memory/5xx/latency/connections alarms, SNS alerts → email |
| `bootstrap/` | S3 bucket (versioned, encrypted) + DynamoDB table for Terraform state |
| `environments/dev/` | Dev sizing: t3.micro RDS, t3.micro Redis, t3.small Kafka, 256cpu/512MB ECS |
| `environments/staging/` | Staging sizing: t3.small RDS, t3.small Redis, 512cpu/1GB ECS |
| `environments/production/` | Prod sizing: r6g.large RDS Multi-AZ, r6g.large Redis ×3, m5.large Kafka ×3, 1024cpu/2GB ECS ×2 |

---

## Execution Sequence

### Step 1: P0 — Consolidate Repos (Day 1, ~2 hours)

```bash
# 1a. Run the port script
export GITHUB_PAT=ghp_...
export GITLAB_ACCESS_TOKEN=glpat_...
bash alia-work/P0-infra/scripts/port-from-gitlab.sh

# 1b. Generate Dockerfiles for all services
cd rald-alia  # the GitHub repo
bash ../alia-work/P0-infra/scripts/generate-dockerfiles.sh

# 1c. Copy CI/CD workflow
mkdir -p .github/workflows
cp ../alia-work/P0-infra/.github/workflows/ci.yml .github/workflows/ci.yml

# 1d. Copy docker-compose files
cp ../alia-work/P0-infra/docker-compose.yml .
cp ../alia-work/P0-infra/docker-compose.dev.yml .
cp ../alia-work/P0-infra/.env.example .

# 1e. Update pnpm-workspace.yaml to include the kafka package
# Add: 'packages/kafka' to the packages list

# 1f. Commit
git add .
git commit -m "feat(p0): complete consolidation — Dockerfiles, CI/CD, docker-compose, kafka package"
git push origin main

# 1g. Archive GitLab
# → gitlab.com/sekanidev/rald-alia → Settings → General → Advanced → Archive project
```

### Step 2: P1 — Provision AWS Infrastructure (Day 1–2, ~3 hours)

```bash
# Prerequisites:
# - AWS CLI configured with credentials
# - Terraform 1.7+ installed
# - ACM wildcard cert for *.alia.rald.cloud in eu-west-1

# 2a. Bootstrap Terraform state
cd alia-work/P1-terraform/bootstrap
terraform init && terraform apply -auto-approve
cd ..

# 2b. Deploy Dev environment
cd environments/dev
# Edit terraform.tfvars: replace ACCOUNT_ID and CERT_ID with real values
terraform init
terraform plan
terraform apply

# 2c. Set secrets after apply
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ENV=dev

for secret in jwt-secret machine-jwt-secret credential-signing-key; do
  aws secretsmanager put-secret-value \
    --secret-id "alia-${ENV}/${secret}" \
    --secret-string "$(openssl rand -base64 64)"
done

# Set notification secrets
aws secretsmanager put-secret-value \
  --secret-id "alia-${ENV}/resend-api-key" \
  --secret-string "re_YOUR_RESEND_KEY"

aws secretsmanager put-secret-value \
  --secret-id "alia-${ENV}/termii-api-key" \
  --secret-string "YOUR_TERMII_KEY"

# 2d. DNS — point *.alia.rald.cloud CNAME to ALB
terraform output alb_dns_name
# → Add CNAME in Cloudflare DNS
```

### Step 3: Build & Push Docker Images (Day 2, ~1 hour per CI run)

```bash
# The GitHub Actions CI will trigger automatically on push to main.
# Or manually trigger:
gh workflow run ci.yml --ref main

# Monitor:
gh run list --workflow=ci.yml
gh run view <run-id>
```

### Step 4: Run Database Migrations (Day 2, ~30 min)

```bash
# From the rald-alia repo root:
# First, set DATABASE_URL to the RDS endpoint (from Secrets Manager)
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id "alia-dev/database-url" \
  --query SecretString --output text)

# Run all migrations
pnpm --filter @rald-alia/db db:migrate

# Run seed data (idempotent)
pnpm --filter @rald-alia/db db:seed
```

### Step 5: Verify All Services Healthy (Day 2, ~30 min)

```bash
ALB_DNS=$(cd alia-work/P1-terraform/environments/dev && terraform output -raw alb_dns_name)

# Health check each service via gateway
curl https://api.alia.rald.cloud/healthz
curl https://api.alia.rald.cloud/v1/identity/health   # direct internal: identity-service
curl https://api.alia.rald.cloud/v1/resolution/health

# Check ECS service status
aws ecs list-services --cluster alia-dev | jq .serviceArns[]
```

---

## What Still Needs Building (P2–P6)

### P2 — Routing Engine (rald-routing Cloudflare Worker)
The existing `rald-routing` worker at `routing.rald.cloud` currently routes RALD users to ALIA instances. It needs to be extended to do full alias resolution:

```
Current:  POST /alia/route → selects ALIA instance
Missing:  POST /resolve → email/phone/username → routing token (calls ALIA resolution-engine)
```

The resolution-engine (deployed on AWS ECS) is the authoritative resolver. The CF Worker should act as the public edge that calls the internal resolution-engine via its ALB endpoint.

**Estimated effort:** 2 days

### P3 — Developer Registry (M7)
The `developer-service` is scaffolded in GitHub but not implemented. Build:
- `POST /projects`, `POST /keys`, `POST /webhooks`, `GET /usage`, `GET /audit`
- Sandbox environment toggle
- SDK access governance

**Estimated effort:** 1 week

### P4 — Machine Identity
Already architected (M4 — machine identity tables + JWT middleware). Actions:
1. Remove `X-Internal-Secret` headers from all services
2. Provision machine JWTs for each service (via `provision-machine-identities.sh` script referenced in auth.rald.cloud)
3. Wire `requireMachineJwt` middleware on all internal service-to-service routes

**Estimated effort:** 3 days

### P5 — Observability (OpenTelemetry)
1. Add `@opentelemetry/sdk-node` to packages/shared
2. Instrument all services with traces + metrics
3. Configure CloudWatch as OTEL exporter
4. Connect to monitoring module dashboards

**Estimated effort:** 1 week

### P6 — Security Hardening
Most security architecture already in code (TLS, RBAC, ABAC, ABAC, MFA, Passkeys, tokenization, immutable audit logs). Remaining:
- HSM integration planning
- mTLS service mesh (Envoy / AWS App Mesh)
- Penetration test

**Estimated effort:** 2 weeks

---

## Launch Gate Checklist

Before any public launch, all of these must be true:

- [ ] P2: Resolution Engine resolves aliases end-to-end (email → routing token)
- [ ] P3: Developer Registry complete — API keys, projects, sandbox
- [ ] P4: All X-Internal-Secret headers removed; machine JWTs in all services
- [ ] P5: CloudWatch dashboard showing real traffic (not just health checks)
- [ ] P6: Internal security review complete; no critical findings
- [ ] Staging environment mirrors production (load test completed)
- [ ] At least one institution integration tested end-to-end
- [ ] Country governance: NG status promoted from INTERNAL → PUBLIC_BETA

---

*Generated by RALD ALIA Phase 1 Scan — 2026-06-13 | LILCKY STUDIO LIMITED*
