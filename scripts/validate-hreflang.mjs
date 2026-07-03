import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "vite";
import localeMetadata from "../src/i18n/locale-metadata.json" with { type: "json" };

const env = loadEnv(process.argv[2] ?? "production", ".", "");
const siteUrl = new URL(env.VITE_SITE_URL);
const buildDirectory = env.BUILD_OUT_DIR ?? "dist";

const expectedAlternates = new Map(
	localeMetadata.map(({ code, path: localePath }) => [
		code,
		new URL(localePath, siteUrl).href,
	]),
);
expectedAlternates.set("x-default", siteUrl.href);

for (const { path: localePath } of localeMetadata) {
	const relativePath = path.join(localePath, "index.html");
	const documentPath = path.join(buildDirectory, relativePath);
	const html = await readFile(documentPath, "utf8");
	const actualAlternates = new Map(
		Array.from(
			html.matchAll(
				/<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"\s*\/?>/g,
			),
			([, language, href]) => [language, href],
		),
	);

	assert.deepEqual(
		actualAlternates,
		expectedAlternates,
		`${documentPath} has incorrect hreflang alternates`,
	);
}

console.log("Validated localized hreflang links.");
