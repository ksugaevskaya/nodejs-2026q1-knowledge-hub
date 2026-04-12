# Stage 1 — build
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --force

COPY . .

RUN npm run build

# Stage 2 — production
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --force

COPY --from=builder /app/dist ./dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

EXPOSE 4000

CMD ["node", "dist/main.js"]