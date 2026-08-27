# Zenith wallpaper producer template

Private template for self-contained wallpapers consumed by the `blank-canvas` macOS renderer.
Every wallpaper lives in its own repository and produces the same publisher bundle without receiving
the registry signing key.

## Start a wallpaper

1. Create a private repository from this GitHub template.
2. Replace the values in `publication.json` and keep the v1 contract shape.
3. Put the wallpaper entry point and every runtime asset under `src/`.
4. Add exactly one catalogue image named `assets/preview.avif`, `preview.webp`, or `preview.png`.
5. Implement `window.wallpaperHost`, dispatch `wallpaper-host-ready`, and post the native `ready` message.
6. Run `npm run release`.

The release command creates:

- `dist/publication.json`
- `dist/pack.zip`
- `dist/preview.*`
- `dist/release-summary.json`

The ZIP is deterministic: file order and timestamps are normalized before archiving. The verifier checks
publication metadata, archive paths, the entry point, declared WASM requirements, hashes, byte counts,
and exact agreement between source metadata and the publisher bundle.

Upload the three publisher inputs through the authenticated control plane at
`https://zenith-research.ca/admin/wallpapers`. Release versions are immutable; increment
`publication.json.version` for every publication.

## Host bridge

```js
window.wallpaperHost = {
  apiVersion: "1.0",
  applyPreferences({ reducedMotion, stillness }) {},
  performAction(actionID) {},
  setVisible(isVisible) {},
  dispose() {},
};

document.dispatchEvent(new Event("wallpaper-host-ready"));
window.webkit?.messageHandlers?.zenithRuntime?.postMessage({
  type: "ready",
  apiVersion: "1.0",
  capabilities: [],
});
```

Keep wallpaper source, compiled runtime assets, previews, and generated releases in this repository.
Do not commit them to the renderer or registry repository.

