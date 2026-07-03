import { evaluateExpression } from "./expression";
import { Dimension, MatrixValues, identityMatrix } from "./math";

export interface MatrixPreset {
	id: string;
	kind: "identity" | "reflection" | "rotation";
	axis: string;
	angle?: number;
	draftValues: string[];
	values: MatrixValues;
}

export function getMatrixPresets(dimension: Dimension): MatrixPreset[] {
	const definitions = dimension === 2 ? matrixPresets2d() : matrixPresets3d();
	return definitions.map((preset) => ({
		...preset,
		values: preset.draftValues.map((value) => {
			const evaluated = evaluateExpression(value);
			if (evaluated === null)
				throw new Error(`Invalid preset value: ${value}`);
			return evaluated;
		}) as MatrixValues,
	}));
}

type PresetDefinition = Omit<MatrixPreset, "values">;

function matrixPresets2d(): PresetDefinition[] {
	return [
		{
			id: "identity",
			kind: "identity",
			axis: "",
			draftValues: ["1", "0", "0", "1"],
		},
		{
			id: "reflect-x",
			kind: "reflection",
			axis: "X",
			draftValues: ["1", "0", "0", "-1"],
		},
		{
			id: "reflect-y",
			kind: "reflection",
			axis: "Y",
			draftValues: ["-1", "0", "0", "1"],
		},
		...([-90, -45, 45, 90] as const).map((angle) =>
			rotationPreset2d(angle),
		),
	];
}

function rotationPreset2d(angle: -90 | -45 | 45 | 90): PresetDefinition {
	const [cosine, sine] = exactTrig(angle);
	return {
		id: `rotate-${angle}`,
		kind: "rotation",
		axis: "",
		angle,
		draftValues: [cosine, negate(sine), sine, cosine],
	};
}

function matrixPresets3d(): PresetDefinition[] {
	const presets: PresetDefinition[] = [
		{
			id: "identity",
			kind: "identity",
			axis: "",
			draftValues: Array.from(identityMatrix(3), String),
		},
		{
			id: "reflect-xy",
			kind: "reflection",
			axis: "XY",
			draftValues: ["1", "0", "0", "0", "1", "0", "0", "0", "-1"],
		},
		{
			id: "reflect-xz",
			kind: "reflection",
			axis: "XZ",
			draftValues: ["1", "0", "0", "0", "-1", "0", "0", "0", "1"],
		},
		{
			id: "reflect-yz",
			kind: "reflection",
			axis: "YZ",
			draftValues: ["-1", "0", "0", "0", "1", "0", "0", "0", "1"],
		},
	];
	for (const axis of ["X", "Y", "Z"] as const) {
		for (const angle of [-90, -45, 45, 90] as const) {
			presets.push(rotationPreset3d(axis, angle));
		}
	}
	return presets;
}

function rotationPreset3d(
	axis: "X" | "Y" | "Z",
	angle: -90 | -45 | 45 | 90,
): PresetDefinition {
	const [c, s] = exactTrig(angle);
	const values =
		axis === "X"
			? ["1", "0", "0", "0", c, negate(s), "0", s, c]
			: axis === "Y"
				? [c, "0", s, "0", "1", "0", negate(s), "0", c]
				: [c, negate(s), "0", s, c, "0", "0", "0", "1"];
	return {
		id: `rotate-${axis.toLowerCase()}-${angle}`,
		kind: "rotation",
		axis,
		angle,
		draftValues: values,
	};
}

function exactTrig(angle: -90 | -45 | 45 | 90): [string, string] {
	if (angle === 90) return ["0", "1"];
	if (angle === -90) return ["0", "-1"];
	return ["sqrt(2)/2", angle > 0 ? "sqrt(2)/2" : "-sqrt(2)/2"];
}

function negate(value: string): string {
	if (value === "0") return value;
	return value.startsWith("-") ? value.slice(1) : `-${value}`;
}
