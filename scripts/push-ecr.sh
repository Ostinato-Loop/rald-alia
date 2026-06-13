#!/usr/bin/env bash
# RALD ALIA — Build and push all service images to AWS ECR
# Prerequisites:
#   - AWS CLI configured with ECR push rights (or ECS task role)
#   - Docker running
#   - Run from repo root: bash scripts/push-ecr.sh [environment]
#
# Usage:
#   bash scripts/push-ecr.sh dev       # default
#   bash scripts/push-ecr.sh staging
#   bash scripts/push-ecr.sh production

set -euo pipefail

ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_PREFIX="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/rald-alia"
GIT_SHA=$(git rev-parse --short HEAD)
TAG="${ENVIRONMENT}-${GIT_SHA}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RALD ALIA — ECR Push"
echo "  Environment: ${ENVIRONMENT}"
echo "  Region:      ${AWS_REGION}"
echo "  Account:     ${ACCOUNT_ID}"
echo "  Tag:         ${TAG}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Authenticate Docker to ECR
echo "[1/3] Authenticating with ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# All ALIA services (sorted by dependency order)
SERVICES=(
  # Infrastructure first
  "identity-service"
  # Core resolution chain
  "alias-service"
  "directory-service"
  "resolution-engine"
  "routing-service"
  # Trust + consent
  "trust-service"
  "consent-service"
  # Governance + compliance
  "governance-service"
  "verification-service"
  "fraud-service"
  # Entity management
  "registry-service"
  "institution-service"
  "merchant-service"
  "developer-service"
  # Async services
  "audit-service"
  "notification-service"
  # Intelligence
  "loop-voice"
  # Control plane
  "control-plane"
  # Gateway last (depends on all above)
  "gateway"
)

echo "[2/3] Building and pushing ${#SERVICES[@]} service images..."
FAILED=()

for svc in "${SERVICES[@]}"; do
  ECR_URI="${ECR_PREFIX}/${svc}"
  echo ""
  echo "  ── ${svc} ──"

  if ! docker build \
      --file "services/${svc}/Dockerfile" \
      --tag "${ECR_URI}:${TAG}" \
      --tag "${ECR_URI}:${ENVIRONMENT}-latest" \
      --cache-from "${ECR_URI}:${ENVIRONMENT}-latest" \
      --build-arg BUILDKIT_INLINE_CACHE=1 \
      . ; then
    echo "  FAILED: build ${svc}"
    FAILED+=("${svc}")
    continue
  fi

  if ! docker push "${ECR_URI}:${TAG}" && \
     ! docker push "${ECR_URI}:${ENVIRONMENT}-latest"; then
    echo "  FAILED: push ${svc}"
    FAILED+=("${svc}")
  else
    echo "  ✓ ${svc} → ${ECR_URI}:${TAG}"
  fi
done

echo ""
echo "[3/3] Results"
echo "  Pushed: $((${#SERVICES[@]} - ${#FAILED[@]})) / ${#SERVICES[@]}"

if [ ${#FAILED[@]} -gt 0 ]; then
  echo "  FAILED: ${FAILED[*]}"
  echo ""
  echo "Fix the failed services and re-run. Successful images are already pushed."
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "All images pushed. Next step:"
echo "  Update ECS task definitions with image tag: ${TAG}"
echo "  Or use the Terraform variable: image_tag = \"${TAG}\""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
