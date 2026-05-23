# Build context must be the monorepo root so npm ci can find package-lock.json.
# In CI, set: context: . and file: ./apps/web/Dockerfile

FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --workspace=apps/web

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./apps/web
COPY package.json ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# outputFileTracingRoot=monorepo root means standalone puts server.js at apps/web/server.js
COPY --from=builder /app/apps/web/.next/standalone        ./
COPY --from=builder /app/apps/web/.next/static            ./apps/web/.next/static
COPY --from=builder /app/apps/web/public                  ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
