# Production-Ready Express & TypeScript API Starter

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey?logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-blueviolet?logo=prisma)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-Valkey-red?logo=redis)](https://redis.io/)
[![Vitest](https://img.shields.io/badge/Vitest-4.x-green?logo=vitest)](https://vitest.dev/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub--Actions-blue?logo=github-actions)](.github/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

A robust, enterprise-grade, and highly scalable **Base Backend Template** built with Express, TypeScript, Prisma, Redis/Valkey, Socket.io, BullMQ, and Prometheus.

---

## 🚀 Quick Start Hero

Scaffold a brand-new project instantly from this template without cloning manually:

```bash
npx @aditya3012singh/create-base-backend
```
*Select the **TypeScript Edition** inside the interactive prompt, and it will clone, rename, and install everything for you.*

---

## 💎 Core Architecture & Features

| Feature | Description | Stack |
| :--- | :--- | :--- |
| **🔒 Secure Authentication** | JWT Access/Refresh token rotation, automatic token reuse invalidation, and failed login attempts account lockouts. | `bcrypt`, `jsonwebtoken` |
| **📊 Tracing & Telemetry** | Flat structured JSON logs linked to request trace IDs propagating automatically across async actions using native `AsyncLocalStorage`. | `winston`, `AsyncLocalStorage` |
| **🛡️ Database Resiliency** | Automatic database connection state diagnostics and custom query execution wrappers that auto-retry queries on deadlocks. | `prisma` |
| **📡 Distributed Event Bus** | Dual-mode bus routing events locally on a single node or distributing them horizontally across clusters. | Redis Pub/Sub |
| **📦 Async Queue Workers** | Dedicated async job processors handling heavy workloads in background threads with retry limits and backoffs. | `bullmq` |
| **🧪 Testing Framework** | Complete test suites with type-safe mocked databases and request integrations. | `vitest`, `supertest` |
| **📖 Live API Specs** | Interactive API testing documentation served directly on the server. | Swagger UI (`/docs`) |

---

## 📂 Directory Layout

```text
├── .github/                 # GitHub workflows configuration
│   └── workflows/
│       └── ci.yml           # Standalone automated CI/CD pipeline
├── deploy/                  # Deployment assets (Nginx config, etc.)
├── prisma/                  # Database modeling
│   ├── schema/              # Modular Prisma schema folder
│   │   ├── config.prisma    # Global client/db properties
│   │   └── user.prisma      # Core User and Auth schema
│   └── seed.ts              # Standard database seeding routine
├── src/                     # Core Application Source Code
│   ├── __tests__/           # Test Suite Utilities
│   │   └── helpers/
│   │       └── prisma.mock.ts # Type-safe database mocking layer
│   ├── api/                 # Express Layer
│   │   ├── middleware/      # Auth validation, Rate limits, Timeout guards, Trace ID tracking
│   │   └── routes/          # Health check, Metrics, and OAuth routers
│   ├── core/                # Core Services Configuration
│   │   ├── cache/           # CacheManager, UserCache, Redis client instance
│   │   ├── config/          # Environment validation (Zod schema), DB wrapper, Socket.io core
│   │   ├── email/           # Nodemailer transport & EmailService
│   │   ├── events/          # DualModeEventBus, event types registry, listener bindings
│   │   ├── health/          # System health check engine
│   │   ├── logger/          # Structured logger & AsyncLocalStorage context manager
│   │   ├── metrics/         # Prometheus registry & system metrics collectors
│   │   ├── pagination/      # Pagination parser and metadata helpers
│   │   └── queue/           # BullMQ QueueService & worker process
│   ├── integrations/        # External integrations
│   │   ├── s3/              # AWS S3 / Cloudflare R2 file uploader
│   │   └── socket/          # Socket.io connection bindings and middleware
│   ├── modules/             # Business Logic Modules
│   │   └── auth/            # Authentication routers, controllers, and schemas
│   │       └── __tests__/   # Unit test suite cases (AuthService tests)
│   ├── app.ts               # Application setup (middlewares and base routers)
│   ├── index.ts             # API entrypoint
│   └── server.ts            # Database and Cache boots, Server setup
├── Dockerfile               # Production multi-stage Docker build config
├── ecosystem.config.cjs     # PM2 production multi-process daemon config
├── tsconfig.json            # TypeScript Compiler configuration
├── package.json             # Base template dependencies
├── .env.example             # Local configuration template environment variables
└── vitest.config.ts         # Testing suite execution rules config
```

---

## 🛠️ Local Development Setup

### 1. Prerequisites
Ensure you have these installed:
- [Node.js](https://nodejs.org/) (v20+)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/)

### 2. Configure Environment variables
Copy `.env.example` to create your local config file:
```bash
cp .env.example .env
```
Update `.env` with your database credentials, Redis host, and keys.

### 3. Initialize Database
Build your database tables and seed sample data:
```bash
# Generate database client
npx prisma generate

# Apply migrations
npx prisma migrate dev

# Seed baseline database records
npx prisma db seed
```

### 4. Running App
```bash
# Start API in hot-reload watch mode
npm run dev

# Start background queue workers
npm run worker

# Build production distribution bundles
npm run build
```

---

## 🧪 Testing & Code Quality

Vitest tests run completely isolated without making queries to your active databases:

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Generate statements & branch coverage report
npm run test:coverage
```

---

## 🧹 Cleaning Up & Customizing

Since this is a starter template, you might want to remove the sample modules to build your own business logic. Here is how to clean it up:

### 1. Remove the Example Auth Module
If you want to build your own authentication or strip it completely:
- Delete the folder: `src/modules/auth/`
- Remove the Auth routes mounting in `src/app.ts`:
  - Delete `import AuthRouter from './modules/auth/auth.routes.js';`
  - Delete `app.use('/api/auth', AuthRouter);`
- Delete the auth passport configurations inside `src/core/config/passport.ts`.

### 2. Reset the Database Schemas
- Delete `prisma/schema/user.prisma` (keeps only `config.prisma` configuration baseline).
- Reset the local migrations:
  ```bash
  npx prisma migrate reset
  ```

### 3. Clear Seeding Routine
- Update `prisma/seed.ts` to remove the default admin and test user seed records.

---

## 🚀 Production Deployment

### PM2 Process Manager
Launch the load balancer and worker queue processes simultaneously:
```bash
# Compile TS files to dist/ JS
npm run build

# Start PM2 daemon
pm2 start ecosystem.config.cjs
```

### Docker
```bash
# Build production image
docker build -t base-backend-ts:latest .

# Launch container
docker run -d -p 4000:4000 --env-file .env.production base-backend-ts:latest
```
