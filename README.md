# Production-Ready Node.js Base Backend Template (TypeScript Edition)

This repository is a clean, production-ready, and highly scalable **Base Backend Template** built with **TypeScript**, Express, Prisma, Redis/Valkey, Socket.io, BullMQ, and Prometheus. It serves as a robust starting point for building modular, high-performance APIs.

---

## 🚀 Key Features

*   **🔒 Auth & Session Management**:
    *   JWT-based session authentication with Access/Refresh token rotation.
    *   Refresh token reuse detection & immediate multi-session invalidation.
    *   OAuth integration out-of-the-box (Google, GitHub) via Passport.
    *   Secure cookie handling (`HttpOnly`, `Secure`, `SameSite`).
*   **📊 Advanced Observability & Telemetry**:
    *   **Trace ID Propagation**: Automatic tracing from HTTP requests through event emissions and database transactions using native `AsyncLocalStorage` (no manual `traceId` argument passing).
    *   **Prometheus Metrics**: Built-in `/metrics` endpoint tracking API durations, error ratios, database transaction profiles, and Redis cache hit ratios.
    *   **Structured Logging**: Winston-based log rotating mechanism writing formatted logs.
*   **📡 Distributed Event Bus & Sockets**:
    *   **Dual-Mode Event Bus**: Gracefully routes local node events or distributes them horizontally across server clusters using Redis Pub/Sub.
    *   **Real-time Sockets**: Socket.io server integrated with the Redis adapter to support multi-instance load balancing.
*   **📦 Async Queuing & Background Tasks**:
    *   Generic BullMQ background worker thread framework connected to the core Redis connection.
    *   Supports concurrency controls, retry limits with exponential backoff, and graceful shutdowns.
*   **📧 Transactional Email Service**:
    *   Nodemailer wrapper supporting SMTP in production.
    *   Automatically falls back to a **Console Log Mock Mode** in local development, preventing email spamming during test sessions.
*   **⚡ Caching Layer**:
    *   Generic Express middleware for API response caching.
    *   Database-level user profile cache warmups in Redis.
*   **🛡️ Database Resiliency**:
    *   Prisma schema organization using the schema folders preview feature (`prisma/schema/*.prisma`).
    *   Database transactional wrapper with automatic query retries on serialization conflicts/deadlocks.

---

## 📂 Project Directory Structure

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

## 🛠️ Getting Started

### 1. Prerequisites
Ensure you have the following installed locally:
*   [Node.js](https://nodejs.org/) (v20+)
*   [PostgreSQL](https://www.postgresql.org/)
*   [Redis](https://redis.io/) (or Valkey)

### 2. Installation
Clone the workspace and run the following in the project root:
```bash
npm install
```

### 3. Environment Configuration
Copy `.env` to configure your environment variables:
```bash
cp .env .env.development
```
Edit the `.env.development` file to include your database connection details, Redis settings, OAuth keys, and SMTP server credentials.

### 4. Database Setup & Client Generation
Build the database tables and compile the local Prisma Client:
```bash
# Generate the Prisma client
npx prisma generate

# Apply migrations and build schema locally
npx prisma migrate dev

# Seed baseline data (Admin user)
npx prisma db seed
```

### 5. Running the Application

To run the main API server in development mode (watches TS files using tsx):
```bash
npm run dev
```

To run the background queue worker process in development mode:
```bash
npm run worker
```

To compile the TypeScript project:
```bash
npm run build
```

### 6. Running Tests
This template is configured with **Vitest** for testing and **vitest-mock-extended** for type-safe Prisma database mocking.

To run the test suite once:
```bash
npm run test
```

To run tests in watch mode during development:
```bash
npm run test:watch
```

To generate a test coverage report:
```bash
npm run test:coverage
```

### 7. Helper Scripts
You can seed test users or administrative accounts from the command line:
```bash
# Seed an Admin User
npx tsx scripts/create_admin.ts

# Seed Test Users
npx tsx scripts/create_test_user.ts
```

---

## 📖 API Documentation (Swagger)

An interactive **Swagger/OpenAPI 3.0** dashboard is automatically exposed:
- **Route**: `http://localhost:4000/docs` (or your configured port).
- Covers endpoint shapes, Zod input validation schemas, cookie and bearer authorization settings, and HTTP response objects.

---

## 🤖 CI/CD Pipeline (GitHub Actions)

A pre-configured GitHub Actions pipeline is defined in `.github/workflows/ci.yml`.
It triggers on every push or pull request to the `main` branch, running:
1. Node.js environment setup and dependencies caching.
2. Prisma client compilation.
3. Strict TypeScript compile checks (`tsc --noEmit`).
4. Complete test suite execution.

---

## 🚀 Production Deployment

### PM2 Process Manager
Deploy both the API server load balancer and the background worker process using the PM2 configurations (runs from `dist/` build):
```bash
# First build the JS files
npm run build

# Start PM2 process daemon
pm2 start ecosystem.config.cjs
```
This spawns:
*   `base-backend-ts-api` (API node)
*   `base-backend-ts-worker` (Async task worker queue runner)

### Docker Build
A multi-stage container build is defined in the [Dockerfile](file:///d:/Projects/base-backend/backend-ts-starter/Dockerfile):
```bash
# Build the production image
docker build -t base-backend-ts:latest .

# Run the container
docker run -d -p 4000:4000 --env-file .env.production base-backend-ts:latest
```

### Nginx Proxy Config
Use the provided [nginx.conf](file:///d:/Projects/base-backend/backend-ts-starter/deploy/nginx.conf) setup to proxy traffic from port 80/443 to the backend API instance, supporting active WebSocket handshakes and rate-limiting rules.
