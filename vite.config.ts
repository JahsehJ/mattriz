import { defineConfig } from "vite";

export default defineConfig({
	base: "./",
	build: {
		// Three.js is intentionally isolated and weighs about 554 kB minified
		// (138 kB gzip). Keep the budget close enough to catch future growth.
		chunkSizeWarningLimit: 600,
		rolldownOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("/node_modules/three/")) return "three";
				},
			},
		},
	},
});
