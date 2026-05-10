import { z } from "zod";

// Server-side env validation. Imported by route handlers, server actions,
// and server components — first import triggers validation. The middleware
// (proxy.ts) intentionally stays lenient so /login can still render an
// error page when env is misconfigured.

const ServerEnv = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Trigger.dev
  TRIGGER_SECRET_KEY: z.string().min(1),
  TRIGGER_PROJECT_ID: z.string().min(1),

  // Site / auth
  SITE_URL: z.string().url(),

  // Encryption
  MASTER_ENCRYPTION_KEY: z.string().min(1),

  // Pipeline (server-side, dev fallback for the app_settings encrypted versions)
  ANTHROPIC_API_KEY: z.string().min(1),

  // Single-tenant
  CLIENT_ID: z.string().uuid(),
});

const ClientEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = ServerEnv.merge(ClientEnv).safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid or missing environment variables:\n${missing}\n\n` +
      `Fill them in /Users/adirgabay/Claude Code/reem-carousel/.env ` +
      `(see .env.example for the schema).`,
  );
}

export const env = parsed.data;
