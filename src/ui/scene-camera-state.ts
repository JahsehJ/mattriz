import * as THREE from "three";
import type { CameraSnapshot, CameraSnapshots } from "../app/camera-snapshot";

export interface CameraControls {
	readonly target: THREE.Vector3;
	update(): boolean;
}

export function captureCameraSnapshots(
	orthoCamera: THREE.OrthographicCamera,
	orthoControls: CameraControls,
	perspectiveCamera: THREE.PerspectiveCamera,
	perspectiveControls: CameraControls,
): CameraSnapshots {
	return {
		2: captureCameraSnapshot(orthoCamera, orthoControls.target),
		3: captureCameraSnapshot(perspectiveCamera, perspectiveControls.target),
	};
}

export function restoreCameraSnapshots(
	snapshots: CameraSnapshots,
	orthoCamera: THREE.OrthographicCamera,
	orthoControls: CameraControls,
	perspectiveCamera: THREE.PerspectiveCamera,
	perspectiveControls: CameraControls,
): void {
	restoreCameraSnapshot(orthoCamera, orthoControls, snapshots[2]);
	restoreCameraSnapshot(perspectiveCamera, perspectiveControls, snapshots[3]);
}

function captureCameraSnapshot(
	camera: THREE.Camera & { zoom: number },
	target: THREE.Vector3,
): CameraSnapshot {
	return {
		position: camera.position.toArray(),
		target: target.toArray(),
		zoom: camera.zoom,
	};
}

function restoreCameraSnapshot(
	camera: THREE.Camera & {
		zoom: number;
		updateProjectionMatrix(): void;
	},
	controls: CameraControls,
	snapshot: CameraSnapshot,
): void {
	camera.position.fromArray(snapshot.position);
	camera.zoom = snapshot.zoom;
	controls.target.fromArray(snapshot.target);
	camera.lookAt(controls.target);
	camera.updateProjectionMatrix();
	controls.update();
}
