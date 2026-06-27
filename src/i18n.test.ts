import { describe, expect, it } from "vitest";
import { translate } from "./i18n";

describe("translations", () => {
  it("translates interface copy into Traditional Chinese", () => {
    expect(translate("zh-Hant", "addVector")).toBe("新增向量");
  });

  it("interpolates values in translated accessibility labels", () => {
    expect(translate("zh-Hant", "matrixEntry", { label: "A", row: 2, column: 3 })).toBe("A 第 2 列第 3 欄");
  });
});
