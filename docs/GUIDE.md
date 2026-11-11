# Game Master Screen — Visual Guide

Screenshot walkthrough of every part of the module. For install,
compatibility, and quick start, see the [README](../README.md).

---

## Scene Controls Toolbar

The "Game Master Screen" category in the left-hand scene controls
toolbar, with all four tools visible: Trigger, Trigger Preset, Close,
Settings.

![Scene controls toolbar](images/gms-control-panel.png)

Clicking **Trigger Preset** opens a small popup listing saved presets in
the order they're arranged in the Presets Manager — click one to fire it
immediately.

![Trigger Preset popup](images/gms-control-panel-trigger-presets.png)

---

## Settings

Reachable either from the **Settings** toolbar tool above, or from
Foundry's own core Configure Settings menu:

![Game Master Screen entry in Foundry's core Settings menu](images/gms-foundry-gm-settings.png)

The full Settings form, with the Preset dropdown, Media Mode selection,
and universal Media/Timing/Automatic Triggers sections:

![Game Master Screen Settings — full window](images/gms-active-window.png)

### Media Modes

Each mode reveals its own fields, with the universal Media and Timing
Configuration sections always visible below regardless of which is
selected.

#### Single Image

![Single Image mode](images/gms-settings-config-single-image.png)

#### Image List

An ordered, GM-curated list with optional shuffle and a configurable
rotation interval.

![Image List mode](images/gms-settings-config-image-list.png)

#### Video

![Video mode](images/gms-settings-config-video.png)

### Save as Preset

Captures the form's current values under a name. If a preset is already
selected in the dropdown, offers to update it in place instead of only
creating new ones.

![Save as Preset](images/gms-settings-config-save-as-preset.png)

### Presets Manager

Rename, reorder (up/down arrows), or delete saved presets — reordering
here also controls the order presets appear in the Trigger Preset popup.

![Presets Manager](images/gms-settings-config-presets-management.png)

---

## Per-Scene Overrides

Every scene's own Configure Sheet gets a new **Game Master Screen** tab.

**Inherit** (default) — plays whatever the global config is set to when
the scene is activated:

![Scene Config tab — Inherit](images/gms-scene-specific-settings-inherit.png)

**Override** — the scene uses its own media/timing config instead of the
global default, and fires on activation regardless of the global
"Trigger on Scene Activation" toggle:

![Scene Config tab — Override](images/gms-scene-specific-settings-override.png)

---

*Screenshots may lag slightly behind the latest UI copy/wording as the
module evolves — the [README](../README.md) is the source of truth for
current behavior if the two ever disagree.*
