# ── Build stage: compile native modules (better-sqlite3) ──────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ──────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Non-root user for security
RUN addgroup -S ftapp && adduser -S ftapp -G ftapp

# Copy compiled node_modules from build stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source (respects .dockerignore)
COPY . .

# Persistent data directories
RUN mkdir -p data uploads && chown -R ftapp:ftapp /app

USER ftapp

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
