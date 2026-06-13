#!/usr/bin/env bash
# RALD ALIA — Set required secrets in AWS Secrets Manager
# Run AFTER bootstrap-terraform.sh and BEFORE push-ecr.sh.
# Reads from environment variables or prompts interactively.
#
# Usage:
#   bash scripts/set-ecs-secrets.sh [environment]

set -euo pipefail

ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
PREFIX="alia-${ENVIRONMENT}"

function put_secret() {
  local name="$1"
  local value="$2"
  local full_name="${PREFIX}/${name}"

  if aws secretsmanager describe-secret --secret-id "${full_name}" &>/dev/null; then
    aws secretsmanager put-secret-value \
      --secret-id "${full_name}" \
      --secret-string "${value}" \
      --region "${AWS_REGION}"
    echo "  updated  ${full_name}"
  else
    aws secretsmanager create-secret \
      --name "${full_name}" \
      --secret-string "${value}" \
      --region "${AWS_REGION}"
    echo "  created  ${full_name}"
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RALD ALIA — Secrets Manager Setup (${ENVIRONMENT})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Shared secrets (required by all services) ─────────────────────────────────
echo "== Shared secrets =="

read -rsp "MACHINE_JWT_SECRET (shared HMAC key — generate with: openssl rand -base64 64): " MACHINE_JWT_SECRET
echo ""
put_secret "shared/machine-jwt-secret" "${MACHINE_JWT_SECRET}"

read -rsp "DATABASE_URL (postgresql://alia:<password>@<rds-host>:5432/alia): " DATABASE_URL
echo ""
put_secret "shared/database-url" "${DATABASE_URL}"

read -rsp "KAFKA_BROKERS (comma-separated, e.g. b-1.msk.eu-west-1.amazonaws.com:9092): " KAFKA_BROKERS
echo ""
put_secret "shared/kafka-brokers" "${KAFKA_BROKERS}"

# ── RALD JWT secret (from rald-auth-core, shared with rald-routing) ───────────
read -rsp "RALD_JWT_SECRET (HMAC key shared with rald-routing and auth-core): " RALD_JWT_SECRET
echo ""
put_secret "shared/rald-jwt-secret" "${RALD_JWT_SECRET}"

# ── Service-specific secrets ──────────────────────────────────────────────────
echo ""
echo "== Per-service machine client secrets =="
echo "(Read from .env.machine-secrets.${ENVIRONMENT} if it exists)"
echo ""

ENV_FILE=".env.machine-secrets.${ENVIRONMENT}"
if [ -f "${ENV_FILE}" ]; then
  echo "  Reading from ${ENV_FILE}..."
  while IFS='=' read -r key value; do
    [[ "${key}" =~ ^# ]] && continue
    [[ -z "${key}" ]]    && continue
    # key format: MACHINE_CLIENT_SECRET_IDENTITY_SERVICE
    svc_upper="${key#MACHINE_CLIENT_SECRET_}"
    svc_lower=$(echo "${svc_upper}" | tr '[:upper:]' '_' | tr '_' '-' | tr '[:upper:]' '[:lower:]')
    put_secret "${svc_lower}/machine-client-secret" "${value}"
  done < "${ENV_FILE}"
  echo "  Done. Delete ${ENV_FILE} now."
else
  echo "  ${ENV_FILE} not found. Run scripts/provision-machine-identities.ts first."
  echo "  Then re-run this script."
fi

# ── Optional: OPENAI_API_KEY for loop-voice ───────────────────────────────────
echo ""
echo "== Loop Voice (optional) =="
read -rsp "OPENAI_API_KEY (for loop-voice transcription/synthesis, leave blank to skip): " OPENAI_KEY
echo ""
if [ -n "${OPENAI_KEY}" ]; then
  put_secret "loop-voice/openai-api-key" "${OPENAI_KEY}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Secrets stored. Next:"
echo "  bash scripts/push-ecr.sh ${ENVIRONMENT}"
echo "  Then terraform apply in environments/${ENVIRONMENT}/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
