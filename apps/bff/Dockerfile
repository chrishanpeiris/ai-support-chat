# Build context must be the monorepo root so npm ci can find package-lock.json.
# In CI, set: context: . and file: ./apps/bff/Dockerfile

FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/bff/package.json ./apps/bff/package.json
RUN npm ci --workspace=apps/bff --omit=dev

FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/bff/package.json ./apps/bff/package.json
RUN npm ci --workspace=apps/bff
COPY apps/bff/src ./apps/bff/src
COPY apps/bff/tsconfig.json ./apps/bff/tsconfig.json
RUN npm run build -w apps/bff

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/bff/dist          ./apps/bff/dist
COPY --from=builder /app/apps/bff/src/db/schema.sql ./apps/bff/dist/db/schema.sql
COPY --from=builder /app/apps/bff/src/db/seed.sql   ./apps/bff/dist/db/seed.sql
COPY --from=deps    /app/node_modules           ./node_modules
COPY apps/bff/package.json ./apps/bff/
WORKDIR /app/apps/bff
EXPOSE 3001
CMD ["node", "dist/index.js"]
