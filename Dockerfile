FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Production uses PostgreSQL schema.
RUN npx prisma generate --schema prisma/schema.postgres.prisma
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Keep schema in sync and run Next.js.
# Optional one-time seed in production via RUN_PRISMA_SEED=true.
CMD sh -c "npx prisma db push --schema prisma/schema.postgres.prisma && if [ \"${RUN_PRISMA_SEED}\" = \"true\" ]; then npm run prisma:seed; fi && npm run start -- -p ${PORT:-3000}"
