# Game Master Screen

A Foundry VTT module for a full-screen, GM-controlled overlay — for pauses,
intermissions, and scene transitions — with a compact, non-blocking GM
preview pane so triggering it never gets in the way of running the game.

---

## Features

**Two ways to trigger**
- **Manual** — a scene-controls toolbar button. Fire it anytime: a five
  minute break, a dramatic reveal, whatever the moment calls for.
- **Automatic on Scene Activation** — optionally shows Game Master Screen
  whenever a GM activates a scene (the "Activate" button, not just
  viewing it), using whatever media is currently configured.

**Three media modes**
- **Single Image**
- **Image List** — rotates through a GM-curated, ordered list of images,
  with optional randomized order each time it's triggered
- **Video**

**Universal audio, fit, and timing** — apply regardless of which media
mode is active:
- An independent audio track that can pair with any mode (forces a
  video's own audio off when set, so it doesn't play both at once)
- Picture/Video Fit: Contain, Cover, Stretch, or Original size
- Loop, Mute, and a Volume slider with a live percentage readout
- Duration (auto-close after N seconds, or leave at 0 to close manually)
- Fade In / Fade Out (ms), with audio volume ramped down in sync on
  fade-out rather than cutting audio dead

**Presets** — save named configurations and reload them instantly, update
an existing preset in place, or save variations as new ones. Manage
(rename/delete) from a dedicated Presets app, reachable from Settings or
from core Foundry's own Settings menu.

**GM experience**
- A small, draggable, non-blocking preview pane (not a full-screen
  block) — the GM keeps full canvas access to manage tokens, lighting,
  and scenes while the players' screens are locked
- Configurable size (Small / Medium / Large / Extra Large) and an
  opt-in audio toggle, both personal per-GM-account preferences —
  useful for a co-GM or second-monitor setup that wants a different
  experience than the primary GM
- Works correctly for both the Gamemaster and Assistant Gamemaster
  roles
- Any GM account can close it for everyone — including recovering from
  a crash or dropped connection on whichever GM triggered it

**Player experience**
- Full-bleed, opaque overlay — no UI bleed-through
- All keyboard and mouse input is inert while it's active, as if the
  screen were paused
- A client that connects mid-activation (late join, reload, reconnect)
  catches up automatically instead of missing the moment entirely

**Scene playlist coordination** — when triggered by scene activation,
automatically silences that scene's own linked playlist (if it has one)
so it doesn't layer on top of GMS's own audio, and resumes it once GMS's
fade-out finishes.

---

## Requirements

Built and tested against Foundry VTT V14 (Stable). Minimum supported
version: V13.

---

## Installation

Install via the module manifest URL in Foundry's Add-on Modules browser,
or download and extract into your `Data/modules` folder.

---

## Usage

**Scene Controls** — a new "Game Master Screen" category appears in the
left-hand scene controls toolbar for GMs, with three tools:
- **Trigger** — fires Game Master Screen using the currently configured
  media. Safe to click even if it's already active (no-ops with a
  notification rather than double-firing).
- **Close** — ends it for everyone, from any GM account. Safe to click
  even if nothing's active; this is the "nuke" button for recovering
  from a crash or a stuck state.
- **Settings** — opens the configuration form.

**Settings** — configure media mode, universal audio/fit/timing options,
and the automatic scene-activation trigger. Includes:
- **Preview** — renders the full player-facing overlay locally on your
  own screen only, using whatever's currently in the form (not yet
  saved). Click anywhere to dismiss.
- **Save as Preset** — captures the current form values under a name.
  If a preset is already selected in the dropdown, offers to update it
  in place instead of only creating new ones.

**Personal preferences** (Foundry's core Settings list, per GM account):
- **GM Popout Size** — Small, Medium, Large, or Extra Large
- **GM Popout Audio** — off by default; opt in if you want to hear the
  audio in your own preview pane too (mainly useful for fully remote
  tables)
- **Debug Logging** — shows on-screen notifications confirming socket
  events and lifecycle hooks are firing, for troubleshooting without
  needing to check the browser console

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
already have a competing module's config present.

This list isn't exhaustive — if you run into a conflict with another
scene-loading or intermission-style module not listed here, please open
an issue.

---

## Roadmap

- **Per-scene overrides** — a dedicated Scene Configuration tab to set a
  scene to Inherit (use global default), Override (its own media/timing
  config), or Disable (never trigger on this scene, regardless of the
  global auto-trigger setting)
- **Profile toolbar tool** — a dedicated scene-controls button to
  instantly trigger a specific saved preset, without opening Settings

**Considered and shelved for now:** hijacking Foundry's native
spacebar-pause to also show Game Master Screen. The convenience of one
fewer click didn't outweigh the risk of an accidental spacebar press
triggering a full-screen overlay for every player, versus today's small
UX cost of a single deliberate Trigger click.

---

## License

MIT
