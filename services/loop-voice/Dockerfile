FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY services/loop-voice ./services/loop-voice
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rald-alia/shared build
RUN pnpm --filter @rald-alia/loop-voice build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/loop-voice/dist ./dist
COPY --from=builder /app/services/loop-voice/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3013
CMD ["node", "dist/index.js"]
