import { MAX_EXPRESSION_LENGTH } from "./policy";

export function evaluateExpression(source: string): number | null {
	if (source.length > MAX_EXPRESSION_LENGTH) return null;
	try {
		const parser = new ExpressionParser(source);
		const value = parser.parse();
		return Number.isFinite(value) ? value : null;
	} catch {
		return null;
	}
}

export function evaluateBoundedExpression(
	source: string,
	maxAbsoluteValue: number,
): number | null {
	const value = evaluateExpression(source);
	return value !== null && Math.abs(value) <= maxAbsoluteValue ? value : null;
}

class ExpressionParser {
	private index = 0;

	constructor(private readonly source: string) {}

	parse(): number {
		const value = this.parseAdditive();
		this.skipWhitespace();
		if (this.index !== this.source.length)
			throw new Error("Unexpected input");
		return this.finite(value);
	}

	private parseAdditive(): number {
		let value = this.parseMultiplicative();
		for (;;) {
			if (this.consume("+")) value += this.parseMultiplicative();
			else if (this.consume("-")) value -= this.parseMultiplicative();
			else return this.finite(value);
		}
	}

	private parseMultiplicative(): number {
		let value = this.parseUnary();
		for (;;) {
			if (this.consume("*")) value *= this.parseUnary();
			else if (this.consume("/")) {
				const divisor = this.parseUnary();
				if (divisor === 0) throw new Error("Division by zero");
				value /= divisor;
			} else return this.finite(value);
		}
	}

	private parseUnary(): number {
		if (this.consume("+")) return this.parseUnary();
		if (this.consume("-")) return -this.parseUnary();
		return this.parsePower();
	}

	private parsePower(): number {
		const base = this.parsePrimary();
		if (!this.consume("^")) return base;
		return this.finite(Math.pow(base, this.parseUnary()));
	}

	private parsePrimary(): number {
		if (this.consume("(")) {
			const value = this.parseAdditive();
			if (!this.consume(")")) throw new Error("Missing parenthesis");
			return value;
		}

		const identifier = this.readIdentifier();
		if (identifier) {
			if (identifier === "pi") return Math.PI;
			if (!["sqrt", "sin", "cos", "tan"].includes(identifier))
				throw new Error("Unknown function");
			if (!this.consume("("))
				throw new Error("Missing function argument");
			const argument = this.parseAdditive();
			if (!this.consume(")")) throw new Error("Missing parenthesis");
			if (identifier === "sqrt") {
				if (argument < 0) throw new Error("Non-real square root");
				return Math.sqrt(argument);
			}
			if (identifier === "sin") return Math.sin(argument);
			if (identifier === "cos") return Math.cos(argument);
			if (Math.abs(Math.cos(argument)) < 1e-12)
				throw new Error("Undefined tangent");
			return Math.tan(argument);
		}

		return this.readNumber();
	}

	private readIdentifier(): string {
		this.skipWhitespace();
		const start = this.index;
		while (/[a-z]/i.test(this.source[this.index] ?? "")) this.index += 1;
		return this.source.slice(start, this.index).toLowerCase();
	}

	private readNumber(): number {
		this.skipWhitespace();
		const match = this.source
			.slice(this.index)
			.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
		if (!match) throw new Error("Expected number");
		this.index += match[0].length;
		return this.finite(Number(match[0]));
	}

	private consume(token: string): boolean {
		this.skipWhitespace();
		if (!this.source.startsWith(token, this.index)) return false;
		this.index += token.length;
		return true;
	}

	private skipWhitespace(): void {
		while (/\s/.test(this.source[this.index] ?? "")) this.index += 1;
	}

	private finite(value: number): number {
		if (!Number.isFinite(value)) throw new Error("Non-finite result");
		return value;
	}
}
