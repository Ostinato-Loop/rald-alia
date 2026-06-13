FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/kafka ./packages/kafka
COPY packages/db ./packages/db
COPY services/verification-service ./services/verification-service
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rald-alia/shared build
RUN pnpm --filter @rald-alia/kafka build
RUN pnpm --filter @rald-alia/db build
RUN pnpm --filter @rald-alia/verification-service build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/verification-service/dist ./dist
COPY --from=builder /app/services/verification-service/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3011
CMD ["node", "dist/index.js"]
