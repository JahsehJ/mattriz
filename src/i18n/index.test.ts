import { describe, expect, it } from "vitest";
import { translate } from ".";

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

	it("localizes share security and clipboard feedback", () => {
		expect(translate("zh-Hant", "share")).toBe("分享");
		expect(translate("en", "invalidShareTitle")).toBe(
			"Invalid shared workspace",
		);
	});

	it("localizes workspace reset confirmation", () => {
		expect(translate("zh-Hant", "resetWorkspace")).toBe("重設工作區");
		expect(translate("en", "confirmResetWorkspace")).toBe(
			"Reset everything",
		);
	});
});
