import { z } from 'zod';

const EnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BACKEND_HOST: z.string().trim().min(1).default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ANALYSIS_MODE: z.enum(['mock', 'live']).default('mock'),
  OPENAI_API_KEY: z.string().trim().optional().transform((value) => value || undefined),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-4.1-mini'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:4200'),
  MAX_IMAGE_SIZE_MB: z.coerce.number().positive().max(20).default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().max(1000).default(5),
  DAILY_ANALYSIS_LIMIT: z.coerce.number().int().positive().max(100_000).default(10),
  DAILY_ANALYSIS_STATE_FILE: z.string().trim().min(1).default('./data/daily-usage.json'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(30_000)
});

export type AppConfig = z.infer<typeof EnvironmentSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvironmentSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Backend-Konfiguration ungültig: ${details}`);
  }
  const key = parsed.data.OPENAI_API_KEY;
  if (parsed.data.ANALYSIS_MODE === 'live' && (!key || key === 'your_openai_api_key_here' || !key.startsWith('sk-'))) {
    throw new Error('Live-Modus ist aktiviert, aber OPENAI_API_KEY fehlt oder ist nur ein Platzhalter. Trage einen gültigen Schlüssel in server/.env ein oder setze ANALYSIS_MODE=mock.');
  }
  return parsed.data;
}
