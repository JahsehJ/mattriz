import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
	Dimension,
	Mat2,
	Mat3,
	MatrixValues,
	Vec3,
	VectorValues,
	applyMatrixToVector,
} from "./math";
import { RenderState } from "./state";

const GRID_EXTENT = 240;
const GRID_STEP = 1;
const MAX_PAN_RADIUS = GRID_EXTENT * 0.35;
const GRID_COLOR = 0x45616a;
const GRID_CENTER_COLOR = 0x8fb4bd;
const BASIS_COLORS = [0xff4d43, 0x43d675, 0x5298ff];
const ARROW_SHAFT_RADIUS = 0.03;
const BASIS_ARROW_Z = 0.035;
const USER_ARROW_Z = 0.055;
const AXIS_LABEL_DISTANCE = 1.24;
const AXIS_LABEL_SIZE = 0.34;
const VECTOR_LABEL_OFFSET = 0.2;
const VECTOR_LABEL_SIZE = 0.34;
const DEFAULT_3D_CAMERA_POSITION: Vec3 = [7, 7, 7];

interface ArrowVisual {
	group: THREE.Group;
	shaft: THREE.Mesh;
	head: THREE.Mesh;
	basicMaterial: THREE.MeshBasicMaterial;
	lambertMaterial: THREE.MeshLambertMaterial;
}

interface VectorVisual {
	arrow: ArrowVisual;
	label: THREE.Sprite;
	labelText: string;
	color: string;
}

export class MatrixScene {
	private readonly renderer: THREE.WebGLRenderer;
	private readonly scene = new THREE.Scene();
	private readonly perspectiveCamera = new THREE.PerspectiveCamera(
		45,
		1,
		0.1,
		100,
	);
	private readonly orthoCamera = new THREE.OrthographicCamera(
		-7,
		7,
		7,
		-7,
		0.1,
		100,
	);
	private readonly perspectiveControls: OrbitControls;
	private readonly orthoControls: OrbitControls;
	private readonly gridGroup = new THREE.Group();
	private readonly gridPlanes = {
		xy: createGridPlane("xy"),
		xz: createGridPlane("xz"),
		yz: createGridPlane("yz"),
	};
	private readonly axisLabels = createAxisLabels();
	private readonly root = new THREE.Group();
	private readonly arrowGeometries = {
		shaft: new THREE.CylinderGeometry(1, 1, 1, 16),
		head: new THREE.ConeGeometry(1, 1, 24),
	};
	private readonly basisArrows = BASIS_COLORS.map((color) =>
		this.createArrowVisual(color, 0),
	);
	private readonly vectorVisuals = new Map<string, VectorVisual>();
	private dimension: Dimension = 3;
	private activeControlsDimension: Dimension = 3;
	private viewportWidth = 0;
	private viewportHeight = 0;

	constructor(private readonly canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setClearColor(0x101416, 1);

		this.root.add(
			this.gridGroup,
			this.axisLabels,
			...this.basisArrows.map((arrow) => arrow.group),
		);
		this.gridGroup.add(
			this.gridPlanes.xy,
			this.gridPlanes.xz,
			this.gridPlanes.yz,
		);
		this.scene.add(this.root);
		this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
		const arrowLight = new THREE.DirectionalLight(0xffffff, 1.15);
		arrowLight.position.set(4, 7, 6);
		this.scene.add(arrowLight);

		// Three.js geometry is coordinate-agnostic. A camera-specific up vector
		// gives 3D a mathematical Z-up view without converting any scene data.
		this.perspectiveCamera.up.set(0, 0, 1);
		this.perspectiveCamera.position.fromArray(DEFAULT_3D_CAMERA_POSITION);
		this.perspectiveCamera.lookAt(0, 0, 0);
		this.orthoCamera.position.set(0, 0, 10);
		this.orthoCamera.lookAt(0, 0, 0);

		this.perspectiveControls = new OrbitControls(
			this.perspectiveCamera,
			this.canvas,
		);
		this.perspectiveControls.enableDamping = true;
		this.perspectiveControls.dampingFactor = 0.08;
		this.perspectiveControls.screenSpacePanning = true;
		this.perspectiveControls.minDistance = 2;
		this.perspectiveControls.maxDistance = 28;
		this.perspectiveControls.maxTargetRadius = MAX_PAN_RADIUS;

		this.orthoControls = new OrbitControls(this.orthoCamera, this.canvas);
		this.orthoControls.enableDamping = true;
		this.orthoControls.dampingFactor = 0.08;
		this.orthoControls.enableRotate = false;
		this.orthoControls.screenSpacePanning = true;
		this.orthoControls.mouseButtons = {
			LEFT: THREE.MOUSE.PAN,
			MIDDLE: THREE.MOUSE.DOLLY,
			RIGHT: THREE.MOUSE.PAN,
		};
		this.orthoControls.touches = {
			ONE: THREE.TOUCH.PAN,
			TWO: THREE.TOUCH.DOLLY_PAN,
		};
		this.orthoControls.minZoom = 0.45;
		this.orthoControls.maxZoom = 4;
		this.orthoControls.maxTargetRadius = MAX_PAN_RADIUS;
		this.orthoControls.enabled = false;

		this.resize();
	}

	resetView(dimension = this.dimension): void {
		if (dimension === 2) {
			this.orthoCamera.position.set(0, 0, 10);
			this.orthoCamera.zoom = 1;
			this.orthoCamera.lookAt(0, 0, 0);
			this.orthoCamera.updateProjectionMatrix();
			this.orthoControls.target.set(0, 0, 0);
			this.orthoControls.update();
			return;
		}

		this.perspectiveCamera.position.fromArray(DEFAULT_3D_CAMERA_POSITION);
		this.perspectiveCamera.zoom = 1;
		this.perspectiveCamera.lookAt(0, 0, 0);
		this.perspectiveCamera.updateProjectionMatrix();
		this.perspectiveControls.target.set(0, 0, 0);
		this.perspectiveControls.update();
	}

	render(state: RenderState): void {
		this.resize();
		this.dimension = state.dimension;
		this.updateGrid(state.dimension, state.transform);
		this.updateAxisLabels(state.dimension, state.transform);
		this.updateBasis(state.dimension, state.transform, state.showBasis);
		this.updateVectors(state.dimension, state.transform, state.vectors);
		this.updateControls(state.dimension);
		this.renderer.render(
			this.scene,
			state.dimension === 2 ? this.orthoCamera : this.perspectiveCamera,
		);
	}

	resize(): void {
		const width = Math.max(1, this.canvas.clientWidth);
		const height = Math.max(1, this.canvas.clientHeight);
		if (width === this.viewportWidth && height === this.viewportHeight)
			return;
		this.viewportWidth = width;
		this.viewportHeight = height;

		this.renderer.setSize(width, height, false);

		this.perspectiveCamera.aspect = width / Math.max(1, height);
		this.perspectiveCamera.updateProjectionMatrix();

		const aspect = width / Math.max(1, height);
		const span = 7;
		this.orthoCamera.left = -span * aspect;
		this.orthoCamera.right = span * aspect;
		this.orthoCamera.top = span;
		this.orthoCamera.bottom = -span;
		this.orthoCamera.updateProjectionMatrix();
	}

	private updateControls(dimension: Dimension): void {
		if (dimension !== this.activeControlsDimension) {
			this.perspectiveControls.enabled = dimension === 3;
			this.orthoControls.enabled = dimension === 2;
			this.activeControlsDimension = dimension;
		}

		if (dimension === 2) {
			this.orthoControls.update();
			return;
		}

		this.perspectiveControls.update();
	}

	private updateGrid(dimension: Dimension, matrix: MatrixValues): void {
		this.gridPlanes.xy.visible = true;
		this.gridPlanes.xz.visible = dimension === 3;
		this.gridPlanes.yz.visible = dimension === 3;

		this.gridGroup.matrixAutoUpdate = false;
		this.gridGroup.matrix.copy(toMatrix4(dimension, matrix));
	}

	private updateAxisLabels(dimension: Dimension, matrix: MatrixValues): void {
		const axes: Vec3[] = [
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1],
		];

		this.axisLabels.children.forEach((label, index) => {
			label.visible = index < dimension;
			if (!label.visible) return;

			const endpoint = toThree(
				transformPoint(dimension, matrix, axes[index]),
			);
			if (endpoint.lengthSq() < 0.000001) {
				label.visible = false;
				return;
			}

			endpoint.multiplyScalar(AXIS_LABEL_DISTANCE);
			if (dimension === 2) endpoint.z = USER_ARROW_Z + 0.02;
			label.position.copy(endpoint);
		});
	}

	private updateBasis(
		dimension: Dimension,
		matrix: MatrixValues,
		visible: boolean,
	): void {
		const basis: Vec3[] = [
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1],
		];
		this.basisArrows.forEach((arrow, index) => {
			if (!visible || index >= dimension) {
				arrow.group.visible = false;
				return;
			}
			this.updateArrow(
				arrow,
				transformPoint(dimension, matrix, basis[index]),
				dimension,
				BASIS_ARROW_Z,
			);
		});
	}

	private updateVectors(
		dimension: Dimension,
		matrix: MatrixValues,
		vectors: {
			id: string;
			components: VectorValues;
			color: string;
			label: string;
		}[],
	): void {
		const activeIds = new Set(vectors.map((vector) => vector.id));
		for (const [id, visual] of this.vectorVisuals) {
			if (activeIds.has(id)) continue;
			this.root.remove(visual.arrow.group, visual.label);
			disposeArrowVisual(visual.arrow);
			disposeLabel(visual.label);
			this.vectorVisuals.delete(id);
		}

		vectors.forEach((vector) => {
			const transformed = applyMatrixToVector(
				dimension,
				matrix,
				vector.components,
			);
			let visual = this.vectorVisuals.get(vector.id);
			if (!visual) {
				const color = new THREE.Color(vector.color).getHex();
				visual = {
					arrow: this.createArrowVisual(color, 1),
					label: createTextLabel(
						vector.label,
						color,
						VECTOR_LABEL_SIZE,
					),
					labelText: vector.label,
					color: vector.color,
				};
				this.vectorVisuals.set(vector.id, visual);
				this.root.add(visual.arrow.group, visual.label);
			}

			if (
				visual.labelText !== vector.label ||
				visual.color !== vector.color
			) {
				const color = new THREE.Color(vector.color).getHex();
				updateTextLabel(visual.label, vector.label, color);
				visual.arrow.basicMaterial.color.setHex(color);
				visual.arrow.lambertMaterial.color.setHex(color);
				visual.labelText = vector.label;
				visual.color = vector.color;
			}

			this.updateArrow(
				visual.arrow,
				transformed,
				dimension,
				USER_ARROW_Z,
			);
			this.updateVectorLabel(visual.label, dimension, transformed);
		});
	}

	private updateVectorLabel(
		label: THREE.Sprite,
		dimension: Dimension,
		target: Vec3,
	): void {
		const endpoint = toThree(target);
		const length = endpoint.length();
		label.visible = length >= 0.001;
		if (!label.visible) return;

		endpoint.setLength(length + VECTOR_LABEL_OFFSET);
		if (dimension === 2) endpoint.z = USER_ARROW_Z + 0.02;
		label.position.copy(endpoint);
	}

	private createArrowVisual(color: number, depthBias: number): ArrowVisual {
		const materialOptions = {
			color,
			polygonOffset: depthBias !== 0,
			polygonOffsetFactor: -depthBias,
			polygonOffsetUnits: -depthBias,
		};
		const basicMaterial = new THREE.MeshBasicMaterial(materialOptions);
		const lambertMaterial = new THREE.MeshLambertMaterial(materialOptions);
		const group = new THREE.Group();
		const shaft = new THREE.Mesh(
			this.arrowGeometries.shaft,
			lambertMaterial,
		);
		const head = new THREE.Mesh(this.arrowGeometries.head, lambertMaterial);
		group.add(shaft, head);
		group.renderOrder = depthBias;
		return { group, shaft, head, basicMaterial, lambertMaterial };
	}

	private updateArrow(
		arrow: ArrowVisual,
		target: Vec3,
		dimension: Dimension,
		zLift: number,
	): void {
		const end = toThree(target);
		const length = end.length();
		arrow.group.visible = length >= 0.001;
		if (!arrow.group.visible) return;

		const direction = end.clone().normalize();
		const thicknessScale = Math.min(1, length / 0.25);
		const shaftRadius = ARROW_SHAFT_RADIUS * thicknessScale;
		const headLength = Math.min(ARROW_SHAFT_RADIUS * 4, length * 0.4);
		const headRadius = ARROW_SHAFT_RADIUS * 2.7 * thicknessScale;
		const shaftLength = length - headLength;
		const material =
			dimension === 2 ? arrow.basicMaterial : arrow.lambertMaterial;

		arrow.shaft.material = material;
		arrow.shaft.scale.set(shaftRadius, shaftLength, shaftRadius);
		arrow.shaft.position.y = shaftLength / 2;
		arrow.head.material = material;
		arrow.head.scale.set(headRadius, headLength, headRadius);
		arrow.head.position.y = shaftLength + headLength / 2;
		arrow.group.quaternion.setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			direction,
		);
		arrow.group.position.set(0, 0, dimension === 2 ? zLift : 0);
	}
}

function transformPoint(
	dimension: Dimension,
	matrix: MatrixValues,
	point: Vec3,
): Vec3 {
	return applyMatrixToVector(
		dimension,
		matrix,
		dimension === 2 ? [point[0], point[1]] : point,
	);
}

function toThree(point: Vec3): THREE.Vector3 {
	return new THREE.Vector3(point[0], point[1], point[2]);
}

function createGridPlane(plane: "xy" | "xz" | "yz"): THREE.Group {
	const group = new THREE.Group();
	group.add(
		new THREE.LineSegments(
			createGridGeometry(plane, false),
			new THREE.LineBasicMaterial({
				color: GRID_COLOR,
				transparent: true,
				opacity: 0.42,
			}),
		),
		new THREE.LineSegments(
			createGridGeometry(plane, true),
			new THREE.LineBasicMaterial({
				color: GRID_CENTER_COLOR,
				transparent: true,
				opacity: 0.72,
			}),
		),
	);
	return group;
}

function createAxisLabels(): THREE.Group {
	const group = new THREE.Group();
	["x", "y", "z"].forEach((axis, index) => {
		group.add(createTextLabel(axis, BASIS_COLORS[index], AXIS_LABEL_SIZE));
	});
	return group;
}

function createTextLabel(
	text: string,
	color: number,
	size: number,
): THREE.Sprite {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 128;
	drawLabel(canvas, text, color);

	const material = new THREE.SpriteMaterial({
		map: new THREE.CanvasTexture(canvas),
		depthTest: false,
		transparent: true,
		toneMapped: false,
	});
	const label = new THREE.Sprite(material);
	label.scale.set(size * 2, size, 1);
	label.renderOrder = 3;
	return label;
}

function updateTextLabel(
	label: THREE.Sprite,
	text: string,
	color: number,
): void {
	const texture = label.material.map;
	if (!texture || !(texture.image instanceof HTMLCanvasElement)) return;
	drawLabel(texture.image, text, color);
	texture.needsUpdate = true;
}

function drawLabel(
	canvas: HTMLCanvasElement,
	text: string,
	color: number,
): void {
	const context = canvas.getContext("2d");
	if (!context) return;

	context.clearRect(0, 0, canvas.width, canvas.height);
	context.font = "700 76px Inter, system-ui, sans-serif";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.lineWidth = 10;
	context.strokeStyle = "rgba(16, 20, 22, 0.92)";
	context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
	const renderedText = text.replace(
		/\d/g,
		(digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)],
	);
	context.strokeText(renderedText, 128, 64);
	context.fillText(renderedText, 128, 64);
}

function createGridGeometry(
	plane: "xy" | "xz" | "yz",
	center: boolean,
): THREE.BufferGeometry {
	const positions: number[] = [];
	for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i += GRID_STEP) {
		if ((i === 0) !== center) continue;
		pushGridLine(positions, plane, -GRID_EXTENT, i, GRID_EXTENT, i);
		pushGridLine(positions, plane, i, -GRID_EXTENT, i, GRID_EXTENT);
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(positions, 3),
	);
	return geometry;
}

function pushGridLine(
	positions: number[],
	plane: "xy" | "xz" | "yz",
	a1: number,
	a2: number,
	b1: number,
	b2: number,
): void {
	if (plane === "xy") positions.push(a1, a2, 0, b1, b2, 0);
	if (plane === "xz") positions.push(a1, 0, a2, b1, 0, b2);
	if (plane === "yz") positions.push(0, a1, a2, 0, b1, b2);
}

function toMatrix4(dimension: Dimension, matrix: MatrixValues): THREE.Matrix4 {
	const result = new THREE.Matrix4();
	if (dimension === 2) {
		const m = matrix as Mat2;
		result.set(m[0], m[1], 0, 0, m[2], m[3], 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
		return result;
	}

	const m = matrix as Mat3;
	result.set(
		m[0],
		m[1],
		m[2],
		0,
		m[3],
		m[4],
		m[5],
		0,
		m[6],
		m[7],
		m[8],
		0,
		0,
		0,
		0,
		1,
	);
	return result;
}

function disposeArrowVisual(arrow: ArrowVisual): void {
	arrow.basicMaterial.dispose();
	arrow.lambertMaterial.dispose();
}

function disposeLabel(label: THREE.Sprite): void {
	label.material.map?.dispose();
	label.material.dispose();
}
