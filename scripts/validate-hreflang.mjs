import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const siteUrl = new URL(process.env.VITE_SITE_URL);
const buildDirectory = process.env.BUILD_OUT_DIR ?? "dist";

const expectedAlternates = new Map([
	["en", siteUrl.href],
	["zh-Hant", new URL("zh-hant/", siteUrl).href],
	["x-default", siteUrl.href],
]);

for (const relativePath of ["index.html", "zh-hant/index.html"]) {
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
