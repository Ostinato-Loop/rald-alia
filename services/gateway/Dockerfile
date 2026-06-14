FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY services/gateway ./services/gateway
RUN printf 'packages:\\n  - \"packages/shared\"\\n  - \"services/gateway\"\n' > pnpm-workspace.yaml
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @rald-alia/shared build
RUN pnpm --filter @rald-alia/gateway build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/gateway/dist ./dist
COPY --from=builder /app/services/gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
