import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(import.meta.dirname);
const layers = ["app", "i18n", "infrastructure", "math", "ui"];
const allowedDependencies: Record<string, Set<string>> = {
	app: new Set(["app", "i18n", "math"]),
	i18n: new Set(["i18n"]),
	infrastructure: new Set(["app", "i18n", "infrastructure", "math"]),
	math: new Set(["math"]),
	ui: new Set(["app", "i18n", "math", "ui"]),
};

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
			? [path]
			: [];
	});
}

function imports(file: string): string[] {
	const source = readFileSync(file, "utf8");
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["'](\.[^"']+)["']/g,
		),
	].map((match) => match[1]);
}

function resolveImport(file: string, specifier: string): string | undefined {
	const target = resolve(dirname(file), specifier);
	for (const candidate of [`${target}.ts`, resolve(target, "index.ts")]) {
		try {
			if (statSync(candidate).isFile()) return candidate;
		} catch {
			// The compiler reports missing imports; architecture checks ignore them.
		}
	}
}

const files = layers.flatMap((layer) =>
	sourceFiles(resolve(sourceRoot, layer)),
);
const graph = new Map(
	files.map((file) => [
		file,
		imports(file)
			.map((specifier) => resolveImport(file, specifier))
			.filter((target): target is string => target !== undefined),
	]),
);

describe("architecture boundaries", () => {
	it("keeps dependencies pointing inward", () => {
		const violations: string[] = [];
		for (const [file, dependencies] of graph) {
			const sourceLayer = relative(sourceRoot, file).split("/")[0];
			for (const dependency of dependencies) {
				const targetLayer = relative(sourceRoot, dependency).split(
					"/",
				)[0];
				if (!allowedDependencies[sourceLayer]?.has(targetLayer))
					violations.push(
						`${relative(sourceRoot, file)} -> ${relative(sourceRoot, dependency)}`,
					);
			}
		}
		expect(violations).toEqual([]);
	});

	it("contains no import cycles", () => {
		const cycles: string[] = [];
		const visited = new Set<string>();
		const active = new Set<string>();
		const visit = (file: string, path: string[]): void => {
			if (active.has(file)) {
				cycles.push(
					[...path.slice(path.indexOf(file)), file]
						.map((item) => relative(sourceRoot, item))
						.join(" -> "),
				);
				return;
			}
			if (visited.has(file)) return;
			active.add(file);
			for (const dependency of graph.get(file) ?? [])
				if (graph.has(dependency)) visit(dependency, [...path, file]);
			active.delete(file);
			visited.add(file);
		};
		for (const file of graph.keys()) visit(file, []);
		expect(cycles).toEqual([]);
	});
});
