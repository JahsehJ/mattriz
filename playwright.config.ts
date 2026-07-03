import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: "list",
	use: {
		baseURL,
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "firefox-smoke",
			testMatch: /smoke\.spec\.ts/,
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit-smoke",
			testMatch: /smoke\.spec\.ts/,
			use: { ...devices["Desktop Safari"] },
		},
	],
	webServer: {
		command:
			"npm run build && npx vite preview --host 127.0.0.1 --port 4173",
		env: {
			VITE_SITE_URL: `${baseURL}/`,
		},
		url: baseURL,
		reuseExistingServer: !process.env.CI,
	},
});
