import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, ".", "");
	if (command === "build" && !env.VITE_SITE_URL) {
		throw new Error(
			"VITE_SITE_URL is required for production builds (for example, https://example.com/mattriz/).",
		);
	}
	if (env.VITE_SITE_URL) {
		const siteUrl = new URL(env.VITE_SITE_URL);
		if (!["http:", "https:"].includes(siteUrl.protocol)) {
			throw new Error("VITE_SITE_URL must use HTTP or HTTPS.");
		}
		if (!siteUrl.pathname.endsWith("/") || siteUrl.search || siteUrl.hash) {
			throw new Error(
				"VITE_SITE_URL must end with a slash and cannot contain a query or fragment.",
			);
		}
	}

	return {
		base: "./",
		server: {
			watch: {
				ignored: ["**/coverage/**"],
			},
		},
		build: {
			emptyOutDir: env.BUILD_OUT_DIR ? false : undefined,
			outDir: env.BUILD_OUT_DIR,
			// Three.js is intentionally isolated and weighs about 554 kB minified
			// (138 kB gzip). Keep the budget close enough to catch future growth.
			chunkSizeWarningLimit: 600,
			rolldownOptions: {
				input: {
					main: "index.html",
					zhHant: "zh-hant/index.html",
				},
				output: {
					manualChunks(id) {
						if (id.includes("/node_modules/three/")) return "three";
					},
				},
			},
		},
	};
});
