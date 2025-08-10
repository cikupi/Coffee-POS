# Backend Dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Install deps
COPY backend/package*.json ./
RUN npm ci

# Copy source
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
COPY backend/tsconfig.json ./
COPY backend/src ./src

# Generate Prisma Client and build
RUN npx prisma generate
RUN npm run build

# Runtime stage
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production deps and build output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY backend/package*.json ./

EXPOSE 4000
# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
