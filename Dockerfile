# Stage 1: Build Stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy Prisma schema for client generation
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code and config
COPY . .

# Run TypeScript compilation
RUN npm run build

# Stage 2: Production Runner Stage
FROM node:20-bookworm-slim

WORKDIR /app

# Install OpenSSL for Prisma client execution
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled JS code, prisma client artifacts, and configuration
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.env.production ./.env

# Regenerate Prisma Client within final container to match OS architecture
RUN npx prisma generate

# Set environment
ENV NODE_ENV=production
ARG PORT=4000
ENV PORT=${PORT}
EXPOSE ${PORT}

# Start the server using the compiled main module
CMD ["npm", "start"]
