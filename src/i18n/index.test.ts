import { describe, expect, it } from "vitest";
import { localeMetadata, messages, translate } from ".";

describe("translations", () => {
	it("translates interface copy into Traditional Chinese", () => {
		expect(translate("zh-Hant", "addVector")).toBe("新增向量");
	});

	it("interpolates values in translated accessibility labels", () => {
		expect(
			translate("zh-Hant", "matrixEntry", {
				label: "A",
				row: 2,
				column: 3,
			}),
		).toBe("A 第 2 列第 3 欄");
	});

	it("uses the same interpolation placeholders in every locale", () => {
		for (const key of Object.keys(
			messages.en,
		) as (keyof typeof messages.en)[]) {
			expect(placeholders(messages["zh-Hant"][key]), key).toEqual(
				placeholders(messages.en[key]),
			);
		}
	});

	it("keeps locale metadata complete and unambiguous", () => {
		expect(localeMetadata.map(({ code }) => code).sort()).toEqual(
			Object.keys(messages).sort(),
		);
		expect(new Set(localeMetadata.map(({ code }) => code)).size).toBe(
			localeMetadata.length,
		);
		expect(
			new Set(
				localeMetadata.flatMap(({ languageTags }) =>
					languageTags.map((tag) => tag.toLowerCase()),
				),
			).size,
		).toBe(
			localeMetadata.reduce(
				(count, { languageTags }) => count + languageTags.length,
				0,
			),
		);
		for (const { path, languageTags } of localeMetadata) {
			expect(path).toMatch(/^(?:\.\/|[a-z0-9-]+\/)$/);
			expect(languageTags.length).toBeGreaterThan(0);
		}
	});
});

function placeholders(message: string): string[] {
	return [...message.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
}
