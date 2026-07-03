import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "public/*.js"],
			// Browser tests exercise the application bootstrap and service worker.
			// They are runtime entry points rather than independently unit-testable modules.
			exclude: [
				"src/**/*.test.ts",
				"src/vite-env.d.ts",
				"src/main.ts",
				"public/sw.js",
			],
			reporter: ["text", "html"],
			thresholds: {
				statements: 68,
				branches: 55,
				functions: 80,
				lines: 68,
				"src/app/**/*.ts": {
					statements: 70,
					branches: 50,
					functions: 80,
					lines: 70,
				},
				"src/domain/**/*.ts": {
					statements: 85,
					branches: 75,
					functions: 95,
					lines: 90,
				},
				"src/i18n/**/*.ts": {
					statements: 95,
					branches: 60,
					functions: 95,
					lines: 95,
				},
				"src/ui/**/*.ts": {
					statements: 42,
					branches: 40,
					functions: 55,
					lines: 44,
				},
			},
		},
	},
});
