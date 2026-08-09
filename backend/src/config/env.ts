import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL environment variable is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET environment variable is required'),
  PORT: z.preprocess(
    (val) => (val ? Number(val) : 8000),
    z.number().positive()
  ).default(8000),
  AI_SERVICE_URL: z.string().default('http://localhost:8001'),
  AI_INTERNAL_API_KEY: z.string().min(1, 'AI_INTERNAL_API_KEY environment variable is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    const insecurePlaceholders = [
      'secret',
      'supersecret',
      'change-me',
      'default-secret',
      'generate_your_secure_random_secret_key_here',
      'saferoad-internal-secret-2026',
    ];
    if (
      data.JWT_SECRET.length < 32 ||
      insecurePlaceholders.includes(data.JWT_SECRET.toLowerCase())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message:
          'In production, JWT_SECRET must be at least 32 characters long and not use default placeholder values.',
      });
    }

    if (
      data.AI_INTERNAL_API_KEY.length < 16 ||
      insecurePlaceholders.includes(data.AI_INTERNAL_API_KEY.toLowerCase())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_INTERNAL_API_KEY'],
        message:
          'In production, AI_INTERNAL_API_KEY must be at least 16 characters long and not use default placeholder values.',
      });
    }
  }
});


const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const issues = parseResult.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error('❌ Invalid environment variables:\n' + issues);
  throw new Error('FATAL: Environment variable validation failed:\n' + issues);
}

export const env = parseResult.data;
