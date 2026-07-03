import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./expression";

describe("mathematical expression evaluation", () => {
	it("supports arithmetic, precedence, fractions, and scientific notation", () => {
		expect(evaluateExpression("1/2 + 2 * 3")).toBe(6.5);
		expect(evaluateExpression("(1 + 2) / 3")).toBe(1);
		expect(evaluateExpression("1e-2")).toBe(0.01);
	});

	it("supports right-associative powers and standard unary precedence", () => {
		expect(evaluateExpression("2^3^2")).toBe(512);
		expect(evaluateExpression("-2^2")).toBe(-4);
		expect(evaluateExpression("2^(-3)")).toBe(0.125);
	});

	it("supports radicals, radians-based trigonometry, and pi", () => {
		expect(evaluateExpression("sqrt(2)/2")).toBeCloseTo(Math.SQRT1_2);
		expect(evaluateExpression("sin(pi/2)")).toBeCloseTo(1);
		expect(evaluateExpression("cos(pi)")).toBeCloseTo(-1);
		expect(evaluateExpression("tan(pi/4)")).toBeCloseTo(1);
	});

	it("rejects unsafe, malformed, implicit, and non-real expressions", () => {
		for (const expression of [
			"",
			"2sqrt(3)",
			"2(3)",
			"sqrt(-1)",
			"1/0",
			"0^(-1)",
			"tan(pi/2)",
			"unknown(1)",
			"1 +",
		]) {
			expect(evaluateExpression(expression)).toBeNull();
		}
	});

	it("does not impose application input limits", () => {
		expect(evaluateExpression("1".repeat(65))).not.toBeNull();
	});
});
