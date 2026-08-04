import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables before parsing
dotenv.config();

const substituteEnvVars = (value: string): string => {
  return value.replace(/\${([^}]+)}/g, (_, name) => process.env[name] || '');
};

const envSchema = z.object({
  // Server
  PORT: z.string().default("4000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().optional().transform(val => val ? val.split(",") : []),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().transform(val => val ? substituteEnvVars(val.trim()) : val).pipe(z.string().url()).optional(),
  REDIS_HOST: z.string().default("redis"),
  REDIS_PORT: z.string().default("6379").transform(Number),
  REDIS_PASSWORD: z.string().optional(),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // AWS/S3
  S3_REGION: z.string().default("auto"),
  S3_BUCKET_NAME: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_PUBLIC_URL: z.string().url().optional(),
  S3_AVATAR_BUCKET: z.string().default("profile"),

  // Email Configs (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().default("noreply@basebackend.com"),

  // Queue Configs
  QUEUE_NAME: z.string().default("default_queue"),
  WORKER_CONCURRENCY: z.string().default("5").transform(Number),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().optional(),
});

export type EnvType = z.infer<typeof envSchema>;

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env: EnvType = _env.data;
export default env;
