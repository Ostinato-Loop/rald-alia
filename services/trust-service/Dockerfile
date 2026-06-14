FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY packages/kafka ./packages/kafka
COPY packages/db ./packages/db
COPY services/trust-service ./services/trust-service
RUN printf 'packages:\\n  - \"packages/shared\"\\n  - \"packages/kafka\"\\n  - \"packages/db\"\\n  - \"services/trust-service\"\n' > pnpm-workspace.yaml
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @rald-alia/shared build
RUN pnpm --filter @rald-alia/kafka build
RUN pnpm --filter @rald-alia/db build
RUN pnpm --filter @rald-alia/trust-service build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/trust-service/dist ./dist
COPY --from=builder /app/services/trust-service/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3008
CMD ["node", "dist/index.js"]
