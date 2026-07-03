import type { Dimension, MatrixFor } from "../math/matrix";
import { evaluateExpression } from "../math/expression";

export interface MatrixPreset<D extends Dimension = Dimension> {
	id: string;
	kind: "reflection" | "rotation";
	subject:
		| { kind: "axis"; name: string }
		| { kind: "plane"; name: string }
		| { kind: "angle"; degrees: number }
		| { kind: "axis-angle"; axis: string; degrees: number };
	draftValues: string[];
	values: MatrixFor<D>;
}

export function getMatrixPresets<D extends Dimension>(
	dimension: D,
): MatrixPreset<D>[] {
	const definitions: PresetDefinition[] =
		dimension === 2
			? [
					{
						id: "reflect-x",
						kind: "reflection",
						subject: { kind: "axis", name: "X" },
						draftValues: ["1", "0", "0", "-1"],
					},
					{
						id: "reflect-y",
						kind: "reflection",
						subject: { kind: "axis", name: "Y" },
						draftValues: ["-1", "0", "0", "1"],
					},
					{
						id: "rotate-45",
						kind: "rotation",
						subject: { kind: "angle", degrees: 45 },
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
						subject: { kind: "plane", name: "XY" },
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
						subject: { kind: "plane", name: "XZ" },
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
						subject: { kind: "plane", name: "YZ" },
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
						subject: {
							kind: "axis-angle",
							axis: "X",
							degrees: 45,
						},
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
						subject: {
							kind: "axis-angle",
							axis: "Y",
							degrees: 45,
						},
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
						subject: {
							kind: "axis-angle",
							axis: "Z",
							degrees: 45,
						},
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
	return definitions.map((definition) => {
		const values = definition.draftValues.map(evaluateExpression);
		if (values.some((value) => value === null))
			throw new Error(`Invalid matrix preset: ${definition.id}`);
		return {
			...definition,
			values: values as MatrixFor<D>,
		};
	});
}

type PresetDefinition = Omit<MatrixPreset, "values">;
