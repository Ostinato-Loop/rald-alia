FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY services/developer-service ./services/developer-service
RUN printf 'packages:\\n  - \"packages/shared\"\\n  - \"packages/db\"\\n  - \"services/developer-service\"\n' > pnpm-workspace.yaml
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @rald-alia/shared build
RUN pnpm --filter @rald-alia/db build
RUN pnpm --filter @rald-alia/developer-service build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/developer-service/dist ./dist
COPY --from=builder /app/services/developer-service/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3010
CMD ["node", "dist/index.js"]
