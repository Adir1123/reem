import { defineConfig } from "@trigger.dev/sdk/v3";
import { pythonExtension } from "@trigger.dev/python/extension";

// Per-client value. Read from env so the same code works for every client.
// At build time the Trigger.dev GitHub integration exposes env vars whose
// names start with `TRIGGER_BUILD_` — the prefix is stripped on the build
// server, so `TRIGGER_BUILD_PROJECT_REF` becomes available as `PROJECT_REF`.
// For local manual deploys, set PROJECT_REF in apps/trigger/.env.
const PROJECT_REF = process.env.PROJECT_REF;
if (!PROJECT_REF) {
  throw new Error(
    "PROJECT_REF env var is not set. " +
      "On Trigger.dev cloud builds, set TRIGGER_BUILD_PROJECT_REF in the project's " +
      "Environment Variables. For local deploys, add PROJECT_REF=proj_... to apps/trigger/.env.",
  );
}

export default defineConfig({
  project: PROJECT_REF,
  dirs: ["./src/tasks"],
  runtime: "node",
  logLevel: "info",
  maxDuration: 600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 5_000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [
      pythonExtension({
        // Inline rather than `requirementsFile` to dodge a bug in
        // @trigger.dev/python@4.4.4 where the auto-generated Dockerfile
        // does `COPY src/python/requirements.txt .` (drops file as
        // ./requirements.txt) then `pip install -r src/python/requirements.txt`
        // (original nested path → not found, build fails). The local
        // src/python/requirements.txt stays on disk for local venv setup.
        requirements: [
          "apify-client>=1.7.0",
          "anthropic>=0.40.0",
          "python-dotenv>=1.0.0",
        ],
        devPythonBinaryPath: ".venv/Scripts/python.exe",
        scripts: [
          "src/python/**/*.py",
          "src/python/references/**/*",
          "src/python/reem-docs/**/*",
        ],
      }),
    ],
  },
});