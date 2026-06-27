# Mattriz

Mattriz is an educational Three.js visualizer for 2D and 3D linear
transformations.

## Features

- 2x2 and 3x3 matrix workspaces.
- Ordered, editable, drag-reorderable matrix stacks.
- Editable and reorderable custom vector columns.
- Step and composed-transform animation with per-matrix durations.
- MathML equation structure with HTML numeric inputs.
- Orthographic 2D and perspective 3D cameras with independent session state.
- Persistent grid geometry shared by the animation pipeline.

## Development

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm audit
```

## Architecture

```text
src/
	main.ts       DOM structure, controls, events, and application loop
	scene.ts      Three.js scene, cameras, grids, axes, and arrows
	state.ts      workspace state, animation state, and render-state derivation
	math.ts       typed matrix/vector operations and input parsing
	math.test.ts  matrix, composition, validation, and animation tests
	styles.css    layout and visual styling
vite.config.ts    build configuration and Three.js vendor chunking
```

The UI uses direct DOM rendering without a frontend framework. Numerical
operations stay in `math.ts`, animation and workspace derivation in `state.ts`,
and Three.js concerns in `scene.ts`.

## Known bugs

- A matrix duration slider can conflict with native drag-reorder behavior in
  some browsers. Drag suppression around the slider reduces the problem but is
  not fully reliable. A dedicated drag handle or pointer-event sorter is the
  likely long-term fix.

