import { defineConfig } from "@trigger.dev/sdk/v3";
import { pythonExtension } from "@trigger.dev/python/extension";


export default defineConfig({
  project: "proj_cbulaxaierwlqqllaahv",
  dirs: ["./src/tasks"],
  runtime: "node",
  logLevel: "info",
  // Bumped from 600s after the new pipeline (query expansion + relevance
  // verification + Pass C critic + optional Pass B rewrite) pushed worst-case
  // runs past the old 10-min cap. Estimate: best case ~7 min, worst case
  // (rewrite path + slow Apify scrapes) ~14 min. 1200s = 20 min gives 6 min
  // of slack while staying well under Trigger.dev's per-task hard limits.
  maxDuration: 1200,
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
        devPythonBinaryPath: ".venv/bin/python",
        scripts: [
          "src/python/**/*.py",
          "src/python/references/**/*",
          "src/python/reem-docs/**/*",
          "src/python/knowledge/**/*",
          "src/python/data/**/*",
        ],
      }),
    ],
  },
});