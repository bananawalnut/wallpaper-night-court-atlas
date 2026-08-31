# Night Court Illustrated Atlas

A layered 2D wallpaper for the `blank-canvas` macOS renderer. It travels between two authored
painted viewpoints—the Starward Loggia and the Sidra Riverfront—using restrained parallax,
river shimmer, window light, and Starfall animation.

This private producer was created from [`ZenithResearch/wallpaper-template`](https://github.com/ZenithResearch/wallpaper-template)
and follows the shared v1 publication contract. Wallpaper source and generated publisher artifacts
remain independent from both the renderer and registry repositories.

Run:

```sh
npm run release
```

The command creates `dist/publication.json`, `dist/pack.zip`, `dist/preview.avif`, and
`dist/release-summary.json`. Upload the first three through the authenticated publisher at
`https://zenith-research.ca/admin/wallpapers`.

The native action surface exposes Loggia, Sidra, arrival replay, and stillness. Reduced-motion
preferences disable establishing movement, parallax, flicker, and Starfall.

For programmatic publishing, manually run the `Build publisher bundle` workflow and choose
`staging` or `production`. GitHub OIDC provides a short-lived repository identity; this repo stores
no Supabase password, registry signing key, or long-lived publisher token.

The atlas imports `src/zenith-wallpaper.js` and connects its actions, motion preference, and visibility lifecycle to the standard Blank Canvas host event interface. Notification requests remain optional and user-controlled by the renderer.
