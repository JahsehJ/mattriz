# Mattriz

Mattriz is an educational Three.js visualizer for 2D and 3D linear
transformations.

## Features

- 2x2 and 3x3 matrix workspaces.
- Ordered, editable, drag-reorderable matrix stacks.
- Editable and reorderable custom vector columns.
- Matrix presets and eigenvector computation.
- Mathematical expressions with fractions, powers, radicals, and trigonometry.
- Step and composed-transform animation with per-matrix durations.
- MathML equation structure with HTML numeric inputs.
- Orthographic 2D and perspective 3D cameras with independent session state.
- Installable progressive web app with offline app-shell support.

## Development

```sh
npm ci
npm run dev
```

Run the linter, formatting check, test suite, and production build:

```sh
npm run check
```

## Architecture

```text
src/
├── main.ts         UI, events, and application loop
├── scene.ts        Three.js scene and rendering
├── state.ts        Workspace and animation state
├── math.ts         Matrix and vector operations
├── expression.ts   Expression parsing and validation
├── presets.ts      Matrix and vector presets
├── share.ts        URL-fragment session serialization
├── i18n.ts         Interface translations
└── styles.css      Layout and visual styling
```

The interface uses direct DOM rendering without a frontend framework.
`main.ts` coordinates state and rendering while numerical and Three.js concerns
remain isolated in `math.ts` and `scene.ts`.

Scene geometry uses mathematical coordinates directly. The three-dimensional
camera is Z-up; the two-dimensional camera views the XY plane with Y-up.

Rendering resource ownership and performance guardrails are documented in
[`docs/rendering-performance.md`](docs/rendering-performance.md).

## LLM Disclosure

Mattriz uses LLMs to assist with implementation, analysis, and documentation.
Human developers review the work and retain responsibility for project
decisions.
