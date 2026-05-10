# Stage 1 — build
FROM node:24-alpine AS builder

WORKDIR /app
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

COPY package*.json ./
RUN npm ci --force

COPY . .

RUN npx prisma generate
RUN npm run build

# Stage 2 — production
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev --force
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

RUN mkdir -p /app/logs && chown -R appuser:appgroup /app/logs

USER appuser

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && node dist/src/main.js"]
