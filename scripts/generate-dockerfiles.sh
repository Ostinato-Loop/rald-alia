#!/usr/bin/env bash
# RALD ALIA — Generate Dockerfiles for all services
# Run from the MONOREPO ROOT: bash alia-work/P0-infra/scripts/generate-dockerfiles.sh
# This generates a Dockerfile in each service directory using the canonical template.

set -euo pipefail

SERVICES=(
  "gateway:3000"
  "identity-service:3001"
  "alias-service:3002"
  "directory-service:3003"
  "resolution-engine:3004"
  "routing-service:3005"
  "fraud-service:3006"
  "audit-service:3007"
  "notification-service:3008"
  "governance-service:3009"
  "consent-service:3010"
  "trust-service:3011"
  "merchant-service:3012"
  "verification-service:3013"
  "institution-service:3014"
  "registry-service:3015"
  "developer-service:3016"
  "control-plane:3017"
)

for entry in "${SERVICES[@]}"; do
  SVC="${entry%%:*}"
  PORT="${entry##*:}"
  DIR="services/$SVC"

  if [ ! -d "$DIR" ]; then
    echo "SKIP: $DIR not found"
    continue
  fi

  if [ -f "$DIR/Dockerfile" ]; then
    echo "EXISTS: $DIR/Dockerfile — skipping (delete to regenerate)"
    continue
  fi

  cat > "$DIR/Dockerfile" << DOCKERFILE
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared  ./packages/shared
COPY packages/kafka   ./packages/kafka
COPY packages/db      ./packages/db
COPY packages/sdk     ./packages/sdk
COPY services/${SVC}  ./services/${SVC}
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rald-alia/shared build
RUN pnpm --filter @rald-alia/kafka  build || true
RUN pnpm --filter @rald-alia/db     build
RUN pnpm --filter @rald-alia/sdk    build || true
RUN pnpm --filter @rald-alia/${SVC} build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/${SVC}/dist        ./dist
COPY --from=builder /app/services/${SVC}/package.json ./package.json
COPY --from=builder /app/node_modules                 ./node_modules
RUN addgroup --system --gid 1001 rald && adduser --system --uid 1001 --ingroup rald rald
USER rald
EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \\
  CMD wget -qO- http://localhost:${PORT}/health || exit 1
CMD ["node", "dist/index.js"]
DOCKERFILE

  echo "CREATED: $DIR/Dockerfile (port $PORT)"
done

echo ""
echo "Done. Dockerfiles generated for all present services."
echo "Run: docker-compose build --parallel"
