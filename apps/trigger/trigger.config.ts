import { defineConfig } from "@trigger.dev/sdk/v3";
import { pythonExtension } from "@trigger.dev/python/extension";

export default defineConfig({
  project: "proj_lupvykkongpnnozbgzdy",
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
          "yt-dlp>=2024.10.0",
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
