#!/usr/bin/env bash
# RALD ALIA — Run database migrations across all services
# Runs drizzle-kit push (schema push) for each service that owns DB tables.
# Run AFTER the RDS instance is up and DATABASE_URL is set.
#
# Usage:
#   export DATABASE_URL=postgresql://alia:<password>@<rds-endpoint>:5432/alia
#   bash scripts/run-migrations.sh

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "  export DATABASE_URL=postgresql://alia:<password>@<rds-endpoint>:5432/alia"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RALD ALIA — Database Migrations"
echo "  DB: ${DATABASE_URL%%@*}@[redacted]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "[1/2] Installing packages/db dependencies..."
pnpm --filter @rald-alia/db install --frozen-lockfile
pnpm --filter @rald-alia/db build

echo ""
echo "[2/2] Applying schema..."
# drizzle-kit push applies schema directly without a migration history
# For production, switch to: pnpm --filter @rald-alia/db run migrate
pnpm --filter @rald-alia/db exec drizzle-kit push

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Migrations complete."
echo ""
echo "Next:"
echo "  1. Run machine identity provisioning:"
echo "     pnpm exec tsx scripts/provision-machine-identities.ts"
echo ""
echo "  2. Store the generated .env.machine-secrets.<env> secrets"
echo "     in AWS Secrets Manager per service."
echo ""
echo "  3. Update ECS task definitions with MACHINE_CLIENT_SECRET"
echo "     and MACHINE_SERVICE_NAME per service."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
