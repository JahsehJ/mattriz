import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const buildDirectory = mkdtempSync(path.join(tmpdir(), "mattriz-check-"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const result = spawnSync(npmCommand, ["run", "build"], {
	env: {
		...process.env,
		BUILD_OUT_DIR: buildDirectory,
		VITE_SITE_URL: "https://example.invalid/mattriz/",
	},
	stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
