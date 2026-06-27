import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Dimension, Mat2, Mat3, MatrixValues, Vec3, VectorValues, applyMatrixToVector } from "./math";
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

export class MatrixScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  private readonly orthoCamera = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.1, 100);
  private readonly perspectiveControls: OrbitControls;
  private readonly orthoControls: OrbitControls;
  private readonly gridGroup = new THREE.Group();
  private readonly gridPlanes = {
    xy: createGridPlane("xy"),
    xz: createGridPlane("xz"),
    yz: createGridPlane("yz")
  };
  private readonly root = new THREE.Group();
  private dimension: Dimension = 3;
  private activeControlsDimension: Dimension = 3;
  private viewportWidth = 0;
  private viewportHeight = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x101416, 1);

    this.root.add(this.gridGroup);
    this.gridGroup.add(this.gridPlanes.xy, this.gridPlanes.xz, this.gridPlanes.yz);
    this.scene.add(this.root);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const arrowLight = new THREE.DirectionalLight(0xffffff, 1.15);
    arrowLight.position.set(4, 7, 6);
    this.scene.add(arrowLight);

    this.perspectiveCamera.position.set(7, 6, 7);
    this.perspectiveCamera.lookAt(0, 0, 0);
    this.orthoCamera.position.set(0, 0, 10);
    this.orthoCamera.lookAt(0, 0, 0);

    this.perspectiveControls = new OrbitControls(this.perspectiveCamera, this.canvas);
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
      RIGHT: THREE.MOUSE.PAN
    };
    this.orthoControls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    this.orthoControls.minZoom = 0.45;
    this.orthoControls.maxZoom = 4;
    this.orthoControls.maxTargetRadius = MAX_PAN_RADIUS;
    this.orthoControls.enabled = false;

    window.addEventListener("resize", () => this.resize());
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

    this.perspectiveCamera.position.set(7, 6, 7);
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
    this.clearDynamicObjects();
    if (state.showBasis) this.drawBasis(state.dimension, state.transform);
    this.drawVectors(state.dimension, state.transform, state.vectors);
    this.updateControls(state.dimension);
    this.renderer.render(this.scene, state.dimension === 2 ? this.orthoCamera : this.perspectiveCamera);
  }

  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    if (width === this.viewportWidth && height === this.viewportHeight) return;
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

  private clearDynamicObjects(): void {
    const keep = new Set<THREE.Object3D>([this.gridGroup]);
    for (const child of [...this.root.children]) {
      if (keep.has(child)) continue;
      this.root.remove(child);
      disposeObject(child);
    }
  }

  private drawBasis(dimension: Dimension, matrix: MatrixValues): void {
    const basis: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    basis.slice(0, dimension).forEach((axis, index) => {
      this.addArrow(transformPoint(dimension, matrix, axis), BASIS_COLORS[index], BASIS_ARROW_Z, 0);
    });
  }

  private drawVectors(
    dimension: Dimension,
    matrix: MatrixValues,
    vectors: { components: VectorValues; color: string }[]
  ): void {
    vectors.forEach((vector) => {
      const transformed = applyMatrixToVector(dimension, matrix, vector.components);
      this.addArrow(transformed, new THREE.Color(vector.color).getHex(), USER_ARROW_Z, 1);
    });
  }

  private addArrow(target: Vec3, color: number, zLift: number, depthBias: number): void {
    const end = toThree(target);
    const length = end.length();
    if (length < 0.001) return;

    const direction = end.clone().normalize();
    const thicknessScale = Math.min(1, length / 0.25);
    const shaftRadius = ARROW_SHAFT_RADIUS * thicknessScale;
    const headLength = Math.min(ARROW_SHAFT_RADIUS * 4, length * 0.4);
    const headRadius = ARROW_SHAFT_RADIUS * 2.7 * thicknessScale;
    const shaftLength = length - headLength;
    const materialOptions = {
      color,
      polygonOffset: depthBias !== 0,
      polygonOffsetFactor: -depthBias,
      polygonOffsetUnits: -depthBias
    };
    const material =
      this.dimension === 2
        ? new THREE.MeshBasicMaterial(materialOptions)
        : new THREE.MeshLambertMaterial(materialOptions);
    const arrow = new THREE.Group();

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 16), material);
    shaft.position.y = shaftLength / 2;
    arrow.add(shaft);

    const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, headLength, 24), material);
    head.position.y = shaftLength + headLength / 2;
    arrow.add(head);

    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    arrow.renderOrder = depthBias;
    if (this.dimension === 2) arrow.position.z = zLift;
    this.root.add(arrow);
  }
}

function transformPoint(dimension: Dimension, matrix: MatrixValues, point: Vec3): Vec3 {
  return applyMatrixToVector(dimension, matrix, dimension === 2 ? [point[0], point[1]] : point);
}

function toThree(point: Vec3): THREE.Vector3 {
  return new THREE.Vector3(point[0], point[1], point[2]);
}

function createGridPlane(plane: "xy" | "xz" | "yz"): THREE.Group {
  const group = new THREE.Group();
  group.add(
    new THREE.LineSegments(
      createGridGeometry(plane, false),
      new THREE.LineBasicMaterial({ color: GRID_COLOR, transparent: true, opacity: 0.42 })
    ),
    new THREE.LineSegments(
      createGridGeometry(plane, true),
      new THREE.LineBasicMaterial({ color: GRID_CENTER_COLOR, transparent: true, opacity: 0.72 })
    )
  );
  return group;
}

function createGridGeometry(plane: "xy" | "xz" | "yz", center: boolean): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i += GRID_STEP) {
    if ((i === 0) !== center) continue;
    pushGridLine(positions, plane, -GRID_EXTENT, i, GRID_EXTENT, i);
    pushGridLine(positions, plane, i, -GRID_EXTENT, i, GRID_EXTENT);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function pushGridLine(positions: number[], plane: "xy" | "xz" | "yz", a1: number, a2: number, b1: number, b2: number): void {
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
    1
  );
  return result;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
}
