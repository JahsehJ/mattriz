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
				"src/domain/**/*.ts",
				"src/i18n/**/*.ts",
				"src/infrastructure/**/*.ts",
				"src/rendering/**/*.ts",
				"src/ui/**/*.ts",
				"public/sw-policy.js",
			],
			exclude: ["src/ui/scene.ts"],
			reporter: ["text", "html"],
			thresholds: {
				statements: 68,
				branches: 55,
				functions: 80,
				lines: 68,
				"src/domain/**/*.ts": {
					statements: 85,
					branches: 75,
					functions: 95,
					lines: 90,
				},
				"src/infrastructure/session-codec.ts": {
					statements: 65,
					branches: 55,
					functions: 77,
					lines: 67,
				},
			},
		},
	},
});
