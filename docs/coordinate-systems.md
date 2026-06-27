# Coordinate systems

Mattriz keeps all application data and linear algebra in conventional
right-handed mathematical coordinates. In 3D, Z is the vertical axis.
The Three.js scene uses those coordinates directly.

## Direct coordinates

Three.js defaults object up vectors to Y, but its geometry and renderer do not
require a particular vertical axis. Mattriz therefore uses an identity mapping:

```text
(x, y, z)math = (x, y, z)scene
```

Matrices, basis vectors, custom vectors, grids, and axis labels are created
and rendered without coordinate conversion. For a mathematical transformation
`M` and vector `v`, the scene position is simply:

```text
Mv
```

## Cameras and controls

The 3D perspective camera sets `up` to `(0, 0, 1)` before OrbitControls is
constructed. OrbitControls derives its orbit and pan calculations from that
camera-specific up vector, so mathematical Z remains vertical. The default
camera position is `(7, 7, 7)`, producing a symmetric view with X on the left,
Y on the right, and Z up.

The 2D orthographic camera retains Three.js's default `(0, 1, 0)` up vector. It
looks down the Z axis at the mathematical XY plane, with X right and Y up. A
global `THREE.Object3D.DEFAULT_UP = (0, 0, 1)` would make this camera's up vector
parallel to its viewing direction, so Mattriz deliberately configures only the
3D camera.

## Why this approach

Camera-specific up vectors are the smallest reliable solution for the current
two-camera architecture:

- Application and scene data share one right-handed coordinate system.
- No per-object or scene-root conversion can be duplicated accidentally.
- Each dimension can use the up direction appropriate to its viewing plane.
- OrbitControls natively respects the active camera's up vector.

Do not change `THREE.Object3D.DEFAULT_UP` globally unless the 2D camera is also
redesigned. New 3D geometry should continue to use mathematical coordinates
directly.
