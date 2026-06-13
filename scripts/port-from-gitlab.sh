#!/usr/bin/env bash
# RALD ALIA — Port GitLab-only content into GitHub repo
# Prerequisites:
#   1. GitHub PAT with repo write access
#   2. GitLab PAT with read access
#   3. Run from a directory OUTSIDE both repos
#
# Usage:
#   export GITHUB_PAT=ghp_...
#   export GITLAB_ACCESS_TOKEN=glpat_...
#   bash port-from-gitlab.sh

set -euo pipefail

GITLAB_REPO="https://oauth2:${GITLAB_ACCESS_TOKEN}@gitlab.com/sekanidev/rald-alia.git"
GITHUB_REPO="https://${GITHUB_PAT}@github.com/Ostinato-Loop/rald-alia.git"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RALD ALIA — GitLab → GitHub Port Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clone both repos
echo "[1/6] Cloning repos..."
git clone "$GITLAB_REPO" alia-gitlab
git clone "$GITHUB_REPO" alia-github

# ── Services to port from GitLab (not in GitHub) ─────────────────────────────
GITLAB_ONLY_SERVICES=(
  "alias-service"
  "directory-service"
  "routing-service"
  "audit-service"
  "notification-service"
  "fraud-service"
  "gateway"
)

echo "[2/6] Porting GitLab-only services..."
for svc in "${GITLAB_ONLY_SERVICES[@]}"; do
  if [ -d "alia-gitlab/services/$svc" ]; then
    cp -r "alia-gitlab/services/$svc" "alia-github/services/$svc"
    echo "  ✓ Ported services/$svc"
  else
    echo "  ✗ WARN: services/$svc not found in GitLab repo"
  fi
done

# ── Port packages/kafka ───────────────────────────────────────────────────────
echo "[3/6] Porting packages/kafka..."
if [ -d "alia-gitlab/packages/kafka" ]; then
  cp -r "alia-gitlab/packages/kafka" "alia-github/packages/kafka"
  echo "  ✓ Ported packages/kafka"
fi

# ── Port frontend apps ────────────────────────────────────────────────────────
echo "[4/6] Porting frontend apps..."
mkdir -p "alia-github/frontend/apps"
for app in admin-console bank-dashboard developer-console marketing-site; do
  if [ -d "alia-gitlab/frontend/apps/$app" ]; then
    cp -r "alia-gitlab/frontend/apps/$app" "alia-github/frontend/apps/$app"
    echo "  ✓ Ported frontend/apps/$app"
  fi
done

# Copy frontend workspace files
for f in package.json pnpm-workspace.yaml tsconfig.base.json; do
  [ -f "alia-gitlab/frontend/$f" ] && cp "alia-gitlab/frontend/$f" "alia-github/frontend/$f"
done

# ── Port API spec ─────────────────────────────────────────────────────────────
echo "[5/6] Porting OpenAPI spec..."
mkdir -p "alia-github/lib"
cp -r alia-gitlab/lib/api-spec  alia-github/lib/api-spec  2>/dev/null && echo "  ✓ Ported lib/api-spec"
cp -r alia-gitlab/lib/api-zod   alia-github/lib/api-zod   2>/dev/null && echo "  ✓ Ported lib/api-zod" || true
cp -r alia-gitlab/lib/api-client-react alia-github/lib/api-client-react 2>/dev/null && echo "  ✓ Ported lib/api-client-react" || true

# ── Commit and push to GitHub ─────────────────────────────────────────────────
echo "[6/6] Committing and pushing to GitHub..."
cd alia-github
git config user.email "infra@rald.cloud"
git config user.name "RALD ALIA Migration"
git add .
git commit -m "feat(p0): port GitLab-only services + frontend + API spec into canonical GitHub repo

Services added: alias-service, directory-service, routing-service,
audit-service, notification-service, fraud-service, gateway

Infrastructure added: packages/kafka, frontend/apps (4 Next.js apps),
lib/api-spec (OpenAPI 3.1), lib/api-zod, lib/api-client-react

GitLab repo: gitlab.com/sekanidev/rald-alia (to be archived after this merge)
GitHub canonical: github.com/Ostinato-Loop/rald-alia

LILCKY STUDIO LIMITED — RALD ALIA Phase 1"

git push origin main
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Done. All GitLab content is now in GitHub."
echo "Next: Archive the GitLab repo at:"
echo "  gitlab.com/sekanidev/rald-alia → Settings → General → Advanced → Archive"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
