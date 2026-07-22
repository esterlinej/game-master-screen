# Changelog

All notable changes to Game Master Screen are documented here. Format
loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [1.1.0] - 2026-07-22

### Added
- Public scripting/macro API at `game.modules.get("game-master-screen").api`
  — `trigger()`, `triggerPreset(nameOrId)`, `close()`, and `isActive()`.
  Built for callers outside GMS's own UI, primarily Monk's Active Tile
  Triggers' "Run Code" action firing GMS off an environmental trigger
  (e.g. a door tile) rather than only a GM's toolbar click.
  `trigger()`/`triggerPreset()`/`close()` require a GM account and
  resolve `false` with a console warning otherwise; `isActive()` has no
  such restriction.
- The GM popout header now shows which preset or scene override is
  currently playing — `Game Master Screen — <name> — active` — instead
  of the generic unlabeled text. Falls back to the original text when
  GMS is fired via the plain global-default trigger, which has no name
  to show.

## [1.0.0] - 2026-07-05

### Changed
- Narrowed Foundry compatibility to V14 only (`minimum: 14`,
  `verified: 14.364`, `maximum: 14`) — V13 is no longer supported.
  Per-Scene Overrides relies on V13/V14's ApplicationV2 Scene Config
  sheet structure in ways that haven't been tested against other major
  versions, so compatibility is capped until explicitly verified.
- Updated author metadata.

## [0.6.0] - 2026-07-05

### Added
- Hero screenshot in the README showing the active player overlay
  alongside the GM's compact preview pane.
- `docs/GUIDE.md` — full screenshot walkthrough of every configuration
  surface (Scene Controls toolbar, Trigger Preset popup, Settings and
  each media mode, Save as Preset, Presets Manager, both Scene Config
  tab modes).

### Changed
- README reorganized: Per-Scene Overrides → Roadmap → Compatibility
  Notes → License, in that order. "Two ways to trigger" became "Three
  ways to trigger" to include Trigger Preset.

## [0.5.0] - Per-Scene Overrides - 2026-07-05

### Added
- New "Game Master Screen" tab injected into Foundry's native Scene
  Config sheet, alongside Basics/Grid/etc. Three modes per scene:
  - **Inherit** (default) — plays the global config; requires the
    global "Trigger on Scene Activation" toggle to be on.
  - **Override** — the scene's own independent media/timing config;
    fires on activation regardless of the global toggle.
  - **Disable** — never triggers for this scene, full stop.
- SLS-aware soft default: scenes with
  [Scene Loading Screens](https://github.com/DeadPanMatt/Scene-Loading-Screens)
  configured default to Disabled the first time the tab is opened for
  that scene — never a hard lock, always switchable.
- Override can optionally load a saved preset's values as a one-time
  starting point via a dropdown, independent of the preset afterward.
- Live warning shown in the tab when the global auto-trigger toggle is
  off and Inherit is selected (the one combination that silently does
  nothing).

### Fixed
During development, in rough chronological order:
- `scene.getFlag()` throwing (rather than returning `undefined`) when
  Scene Loading Screens isn't installed, silently killing the whole tab
  injection — added an active-module check before calling it.
- Missing `MEDIA_FITS` import in `media.js` causing a `ReferenceError`.
- Tab content rendering in the wrong position relative to the sheet's
  Save/Apply footer — inserted alongside the other tab panels instead
  of appended after the footer.
- Tab not appearing on reopening the sheet when it was the last active
  tab, due to Foundry's own tab-restoration logic running before the
  async injection completed.
- Duplicate tab/section stacking on every "Apply" click, since Scene
  Config re-renders in place rather than closing/reopening — now
  removes any prior injection before adding a fresh one.
- Auto-trigger-off warning never actually hiding/showing despite
  correct underlying logic — traced to a missing generic
  `.gms-hidden { display: none }` CSS rule; the class was toggling
  correctly the whole time but nothing defined what "hidden" meant for
  that specific element.
- Warning message layout breaking into disconnected columns —
  `display: flex` directly on a `<p>` containing an inline `<strong>`
  split the text into separate flex items; wrapped the message in a
  single `<span>`.

### Changed
- Override fires on scene activation independent of the global
  "Trigger on Scene Activation" toggle — that toggle now only governs
  Inherit's default behavior, not Override's explicit per-scene choice.

## [0.4.0] - Trigger Preset - 2026-07-05

### Added
- New "Trigger Preset" scene-controls tool, between Trigger and Close:
  opens a popup listing saved presets in their stored order, firing the
  selected one immediately as an ephemeral, one-off override that never
  reads or writes the global-default Settings.
- Preset reordering (up/down arrows) in the Presets Manager; order is
  reflected directly in the Trigger Preset popup.

### Changed
- Extracted `resolveMediaPayload()` / `buildFieldContext()` as shared
  pure functions in `media.js`, reducing duplicated mode-resolution and
  field-context logic between Settings, Presets, and (later) per-scene
  Overrides.

## [0.3.4] and earlier - Initial Release

*Reconstructed from memory of prior development sessions — not verified
against actual commit history. If you want this section broken out with
real per-version accuracy, `git log --oneline` from a local checkout
would let this be corrected.*

### Added
- Manual trigger via a scene-controls toolbar button (Trigger / Close /
  Settings).
- Three mutually-exclusive media modes: Single Image, Image List
  (ordered, with optional randomized rotation), Video.
- Universal audio track, Picture/Video Fit, Loop/Mute/Volume, Duration,
  and Fade In/Out, applying regardless of media mode.
- Automatic trigger on scene activation, with the activated scene's own
  linked playlist automatically silenced and resumed after fade-out.
- Non-blocking, draggable GM popout preview pane — configurable size
  (Small/Medium/Large/XL) and opt-in own-client audio, both per-GM
  client settings.
- Late-join/reload/reconnect catch-up for clients connecting mid-trigger.
- Any GM account can close it for everyone, recovering from a crash or
  dropped connection.
- Presets system: save, update in place, rename, delete named
  configurations.
- Client-scope Debug Logging setting.
