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
cp .env.example .env.development
npm run dev
```

Vite automatically loads `.env.development` in development mode. Environment
files are ignored by Git; `.env.example` documents the required non-secret
values. Variables prefixed with `VITE_` are exposed to client code and must
never contain secrets.

Run the linter, formatting check, test suite, and production build:

```sh
npm run check
```

Install Playwright's headless-only Chromium shell once, then run the browser
tests against a production build:

```sh
npx playwright install chromium --only-shell
npm run test:e2e
```

Set `VITE_SITE_URL` to the absolute public application URL when building for
deployment. Include any deployment subpath and a trailing slash.

```sh
VITE_SITE_URL=https://example.com/mattriz/ npm run build
```

## LLM Disclosure

Mattriz uses LLMs to assist with implementation, analysis, and documentation.
Human developers review the work and retain responsibility for project
decisions.
