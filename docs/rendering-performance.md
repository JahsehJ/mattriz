# Rendering performance

Mattriz renders continuously because transform animation and damped camera
controls both require frame-by-frame updates. The scene therefore treats
resource allocation separately from per-frame state updates.

## Resource ownership

`MatrixScene` owns all Three.js resources. Grid geometry, axis labels, basis
arrows, and custom-vector visuals persist across frames.

- The grid is created once and transformed as a group.
- Basis arrows are created once and updated in place.
- Shaft and arrowhead geometry is shared by every arrow. Each arrow changes
  mesh scale and group rotation instead of rebuilding geometry.
- Custom-vector arrows and labels are stored by vector ID. Rendering reconciles
  this map with the current workspace, creating resources for new IDs and
  disposing materials and textures for removed IDs.
- A vector label keeps one canvas texture. The canvas is redrawn and uploaded
  only when its text or color changes.

Shared geometry belongs to the scene and must not be disposed when an
individual vector is removed. Per-vector materials and label textures belong
to that vector and must be disposed on removal.

## Frame budget

Per-frame work should be limited to numerical transformation, object
visibility, mesh scale, position, rotation, camera controls, and the final
render. Avoid constructing geometry, materials, canvases, or textures in the
frame path.

Small temporary vectors, matrices, and ID sets are currently accepted because
they keep the update code direct and the workspace is small. Pool them only if
profiling shows garbage collection to be material after persistent GPU
resources have already been addressed.

The renderer caps device pixel ratio at 2. Raising that cap has a quadratic
fill-rate and render-target memory cost and requires measurements on mobile
hardware.

## Guardrails

When adding scene elements:

1. Give persistent elements a stable owner and identity.
2. Create GPU resources only when the element or its appearance changes.
3. Update transforms and visibility in place during frames.
4. Dispose element-owned materials and textures when removing it.
5. Do not dispose shared geometry from an individual element.
6. Check both 2D and 3D because they use different cameras and arrow materials.

The application currently creates one `MatrixScene` for the page lifetime. If
scene mounting becomes repeatable, add an explicit `dispose()` method that
removes listeners and releases renderer, control, shared-geometry, grid, and
axis-label resources.

## When to optimize further

Keep continuous rendering while animation and OrbitControls damping depend on
it. Event-driven idle rendering is reasonable only if measurements show idle
power use is a practical issue; it requires an invalidation path for resize,
input, dimension changes, control damping, and animation.

Use browser performance traces and Three.js renderer statistics before adding
pooling, instancing, or a more elaborate scene graph. Those techniques add
coordination cost and are not justified by the current number of arrows.
