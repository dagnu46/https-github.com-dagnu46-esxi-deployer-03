# ==========================================
# Stage 1: Build Frontend and Server Bundle
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application source code
COPY . .

# Build the client frontend into dist/ and bundle server into dist/server.cjs
RUN npm run build

# ==========================================
# Stage 2: Production Runtime Container
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built assets and compiled server from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/init-db.sql ./init-db.sql

# Expose port 3000
EXPOSE 3000

# Healthcheck to ensure container is healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the bundled Express and PostgreSQL backend
CMD ["node", "dist/server.cjs"]
