#!/usr/bin/env bash
# RALD ALIA — Dockerfile inventory
# Dockerfiles are committed for all services.
set -euo pipefail
echo "Services with Dockerfiles:"
for svc in services/*/Dockerfile; do echo "  check $svc"; done
echo ""
echo "To rebuild all: docker-compose build"
echo "To push to ECR: bash scripts/push-ecr.sh"
