# Mattriz Repository Notes

This document records the project’s established behavior and structure for maintainers and coding agents. Setup and general usage are in `README.md`.

## Project context

Mattriz is an educational transformation matrix visualizer approaching its 1.0 pre-release. The interface pairs editable matrix notation with an animated coordinate scene so that composition order and geometric effects can be inspected together.

The current scope is 2D and 3D linear transformations:

- 2D uses 2x2 matrices, vectors lifted to `z = 0`, and a top-down orthographic camera.
- 3D uses 3x3 matrices and a perspective camera.
- Initial matrix and vector stacks are empty, leaving the grid untransformed.
- Translation, nonlinear transforms, persistence, and custom easing are outside the current scope.

## Interface model

The visualizer occupies the primary viewport, with controls concentrated in a bottom equation tray. Editable matrices and vector columns form the operands on the left, followed by an equals sign and read-only transformed vectors on the right. Multiple vectors appear as columns of one matrix.

Large regions use semantic elements such as `main`, `section`, and `footer`; repeated matrix entries use an ordered list. Control dimensions are stable across editing and animation states to limit layout movement.

Duration slider input updates its state and visible value in place. It must not rebuild the equation tray because replacing the active range input interrupts its native pointer interaction. Native drag start is suppressed for the duration of any input pointer gesture so the draggable matrix does not take over slider adjustment or text selection.

Matrix entries and vector components share one draft-validation-commit path. Input text is limited to 16 characters, and only finite values from -100 through 100 are committed; invalid drafts remain editable and are marked with `aria-invalid`.

The visual language is based on a restrained mathematical scene: persistent grid lines, distinct axes, basis vectors, custom vectors, and limited surrounding UI. MathML represents read-only equation structure, while editable cells are HTML inputs.

## Data and animation model

Each dimension has its own workspace containing:

- an ordered matrix list;
- a computed composed matrix;
- a duration and linear easing value for each matrix;
- custom vectors;
- animation and camera state.

Basis vectors and custom vectors derive from the same current transform. Matrix, state, and rendering responsibilities remain separated so that numerical behavior can be tested without constructing a Three.js scene.

## Matrix semantics

Matrices are row-major. `composeMathNotation(dimension, [A, B])` returns `A * B`.

With column vectors, `B` acts first and `A` acts second. The displayed stack is therefore traversed in reverse for step animation. Tests and the README encode this convention because changing it affects both numerical results and the meaning of the interface.

## Code map

- `src/math.ts`: matrix/vector types, multiplication, composition, interpolation, and parsing.
- `src/state.ts`: application workspaces, animation state, and render-state derivation.
- `src/scene.ts`: Three.js renderer, cameras, grids, axes, basis arrows, and vector arrows.
- `src/main.ts`: DOM structure, event handling, controls, and application loop.
- `src/styles.css`: layout and visual design.
- `src/math.test.ts`: focused math, validation, composition-order, and animation tests.
- `vite.config.ts`: production build settings and the separate Three.js vendor chunk.

The project uses TypeScript, Vite, Three.js, and Vitest without a frontend framework.

## Scene behavior

The grid is persistent geometry rather than dense line buffers recreated per frame. Separate 2D and 3D camera states survive dimension switches during a session.

OrbitControls provide rotate, pan, and zoom in 3D. In 2D, left drag pans and wheel or pinch gestures zoom. Only the controls for the active dimension are enabled.

Scene geometry uses mathematical coordinates without conversion. The perspective camera is Z-up, while the orthographic camera remains Y-up to view the XY plane; do not set `THREE.Object3D.DEFAULT_UP` globally.

## Dependencies and verification

Versions in `package.json` are exact. `.npmrc` enables audits, suppresses funding output, and sets `ignore-scripts=true`, so lifecycle scripts do not run during normal installs. A package needing an install script requires an explicit package-level review and one-off command.

The standard repository checks are:

```sh
npm test
npm run build
npm audit
```

Frontend changes are also checked at desktop and mobile widths in both dimensions. Relevant scene checks include a nonblank canvas, controls without overlap, and working camera navigation.
