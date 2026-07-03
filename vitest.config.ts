import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/app/**/*.ts", "src/domain/**/*.ts"],
			reporter: ["text", "html"],
			thresholds: {
				statements: 70,
				branches: 60,
				functions: 70,
				lines: 70,
				"src/domain/**/*.ts": {
					statements: 85,
					branches: 75,
					functions: 95,
					lines: 90,
				},
			},
		},
	},
});
