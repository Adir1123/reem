import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Single source of truth: load the monorepo-root .env so the web app shares
// the same credentials as the Trigger.dev project and any scripts. Next.js'
// own .env.local still takes precedence if present.
loadEnv({ path: resolve(__dirname, "../../.env"), override: false });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
