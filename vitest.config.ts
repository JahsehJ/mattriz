import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			// Keep the coverage boundary to modules exercised by unit tests.
			// Browser-only entry points are covered by Playwright instead.
			include: [
				"src/app/**/*.ts",
				"src/contracts/**/*.ts",
				"src/i18n/**/*.ts",
				"src/infrastructure/**/*.ts",
				"src/math/**/*.ts",
				"src/ui/**/*.ts",
				"public/sw-policy.js",
			],
			reporter: ["text", "html"],
			thresholds: {
				statements: 68,
				branches: 55,
				functions: 80,
				lines: 68,
				"src/infrastructure/share/session-codec.ts": {
					statements: 65,
					branches: 55,
					functions: 77,
					lines: 67,
				},
				"src/math/expression.ts": {
					statements: 90,
					branches: 80,
					functions: 90,
					lines: 90,
				},
				"src/math/eigensystem.ts": {
					statements: 80,
					branches: 65,
					functions: 85,
					lines: 80,
				},
			},
		},
	},
});
