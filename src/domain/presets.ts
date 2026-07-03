import { evaluateExpression } from "./expression";
import { Dimension, MatrixValues } from "./math";

export interface MatrixPreset {
	id: string;
	kind: "reflection" | "rotation";
	axis: string;
	angle?: 45;
	draftValues: string[];
	values: MatrixValues;
}

export function getMatrixPresets(dimension: Dimension): MatrixPreset[] {
	const definitions: PresetDefinition[] =
		dimension === 2
			? [
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
					{
						id: "rotate-45",
						kind: "rotation",
						axis: "",
						angle: 45,
						draftValues: [
							"sqrt(2)/2",
							"-sqrt(2)/2",
							"sqrt(2)/2",
							"sqrt(2)/2",
						],
					},
				]
			: [
					{
						id: "reflect-xy",
						kind: "reflection",
						axis: "XY",
						draftValues: [
							"1",
							"0",
							"0",
							"0",
							"1",
							"0",
							"0",
							"0",
							"-1",
						],
					},
					{
						id: "reflect-xz",
						kind: "reflection",
						axis: "XZ",
						draftValues: [
							"1",
							"0",
							"0",
							"0",
							"-1",
							"0",
							"0",
							"0",
							"1",
						],
					},
					{
						id: "reflect-yz",
						kind: "reflection",
						axis: "YZ",
						draftValues: [
							"-1",
							"0",
							"0",
							"0",
							"1",
							"0",
							"0",
							"0",
							"1",
						],
					},
					{
						id: "rotate-x-45",
						kind: "rotation",
						axis: "X",
						angle: 45,
						draftValues: [
							"1",
							"0",
							"0",
							"0",
							"sqrt(2)/2",
							"-sqrt(2)/2",
							"0",
							"sqrt(2)/2",
							"sqrt(2)/2",
						],
					},
					{
						id: "rotate-y-45",
						kind: "rotation",
						axis: "Y",
						angle: 45,
						draftValues: [
							"sqrt(2)/2",
							"0",
							"sqrt(2)/2",
							"0",
							"1",
							"0",
							"-sqrt(2)/2",
							"0",
							"sqrt(2)/2",
						],
					},
					{
						id: "rotate-z-45",
						kind: "rotation",
						axis: "Z",
						angle: 45,
						draftValues: [
							"sqrt(2)/2",
							"-sqrt(2)/2",
							"0",
							"sqrt(2)/2",
							"sqrt(2)/2",
							"0",
							"0",
							"0",
							"1",
						],
					},
				];
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
