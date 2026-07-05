# game-master-screen
Foundry VTT module for a full-screen GM-controlled pause/loading overlay — trigger manually or on scene activation, with a compact GM-side preview pane that doesn't block board management.

---

## Compatibility Notes

Game Master Screen's automatic "Trigger on Scene Activation" feature can
overlap with other modules that also show something on scene load or
change. Known potentially-overlapping modules:

- **[Scene Loading Screens](https://github.com/DeadPanMatt/Scene-Loading-Screens)**
  — manually-triggered per-scene loading overlays (image/video/audio/text).
  Only collides if a GM uses its "Play Loading Screen" action, since that
  action calls `scene.activate()` internally.
- **[Loading Screen](https://github.com/NoWitchCraft/loading-screen)**
  — replaces Foundry's default loading popup automatically on every scene
  switch by default. Higher chance of collision than the above, since it
  auto-triggers rather than requiring a manual action.

If you use either alongside GMS, consider disabling GMS's automatic
scene-activation trigger for scenes that already have a loading screen
configured in one of those modules (or leave GMS on manual-trigger only).
A future release may add automatic detection/deference for scenes that
already have a competing module's config present — see the project's
open items for status.

This list isn't exhaustive — if you run into a conflict with another
scene-loading or intermission-style module not listed here, please open
an issue.
