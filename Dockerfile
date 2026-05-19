FROM node:20-alpine

WORKDIR /app

# Build tools needed to compile better-sqlite3 native module
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Persistent data directories
RUN mkdir -p data uploads

# Non-root user
RUN addgroup -S ftapp && adduser -S ftapp -G ftapp && \
    chown -R ftapp:ftapp /app

USER ftapp

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
