import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "public/*.js"],
			// Browser tests exercise the application bootstrap, orchestration, and
			// service worker. These are runtime entry points rather than isolated units.
			exclude: [
				"src/**/*.test.ts",
				"src/vite-env.d.ts",
				"src/main.ts",
				"src/app/application-controller.ts",
				"public/sw.js",
			],
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
