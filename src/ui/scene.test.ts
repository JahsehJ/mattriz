import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { MatrixScene } from "./scene";

describe("scene disposal", () => {
	it("releases controls, grid, vector, label, and renderer resources once", () => {
		const gridGeometry = new THREE.BufferGeometry();
		const gridMaterial = new THREE.LineBasicMaterial();
		const labelTexture = new THREE.Texture();
		const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
		const arrowBasic = new THREE.MeshBasicMaterial();
		const arrowLambert = new THREE.MeshLambertMaterial();
		const shaftGeometry = new THREE.BufferGeometry();
		const headGeometry = new THREE.BufferGeometry();
		const disposables = [
			gridGeometry,
			gridMaterial,
			labelTexture,
			labelMaterial,
			arrowBasic,
			arrowLambert,
			shaftGeometry,
			headGeometry,
		];
		const disposeSpies = disposables.map((resource) =>
			vi.spyOn(resource, "dispose"),
		);
		const gridGroup = new THREE.Group();
		gridGroup.add(new THREE.LineSegments(gridGeometry, gridMaterial));
		const axisLabels = new THREE.Group();
		axisLabels.add(new THREE.Sprite(labelMaterial));
		const controls = {
			removeEventListener: vi.fn(),
			dispose: vi.fn(),
		};
		const renderer = { dispose: vi.fn() };
		const scene = Object.assign(Object.create(MatrixScene.prototype), {
			disposed: false,
			perspectiveControls: controls,
			orthoControls: controls,
			handleControlsChange: vi.fn(),
			gridGroup,
			axisLabels,
			basisArrows: [
				{ basicMaterial: arrowBasic, lambertMaterial: arrowLambert },
			],
			vectorVisuals: new Map(),
			arrowGeometries: { shaft: shaftGeometry, head: headGeometry },
			renderer,
		}) as MatrixScene;

		scene.dispose();
		scene.dispose();

		disposeSpies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
		expect(controls.dispose).toHaveBeenCalledTimes(2);
		expect(renderer.dispose).toHaveBeenCalledOnce();
	});
});

describe("scene camera snapshots", () => {
	it("captures and restores both camera modes", () => {
		const perspectiveCamera = new THREE.PerspectiveCamera();
		const orthoCamera = new THREE.OrthographicCamera();
		perspectiveCamera.position.set(1, 2, 3);
		orthoCamera.position.set(4, 5, 6);
		const perspectiveControls = {
			target: new THREE.Vector3(7, 8, 9),
			update: vi.fn(),
		};
		const orthoControls = {
			target: new THREE.Vector3(10, 11, 12),
			update: vi.fn(),
		};
		const scene = Object.assign(Object.create(MatrixScene.prototype), {
			perspectiveCamera,
			orthoCamera,
			perspectiveControls,
			orthoControls,
		}) as MatrixScene;

		const snapshots = scene.getCameraSnapshots();
		expect(snapshots[3].position).toEqual([1, 2, 3]);
		expect(snapshots[2].target).toEqual([10, 11, 12]);

		scene.restoreCameraSnapshots({
			2: { position: [0, 0, 10], target: [0, 0, 0], zoom: 2 },
			3: { position: [7, 7, 7], target: [1, 1, 1], zoom: 1.5 },
		});
		expect(orthoCamera.position.toArray()).toEqual([0, 0, 10]);
		expect(orthoCamera.zoom).toBe(2);
		expect(perspectiveControls.target.toArray()).toEqual([1, 1, 1]);
		expect(perspectiveControls.update).toHaveBeenCalledOnce();
	});
});
