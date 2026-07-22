import { MODULE_ID, SETTINGS, SCENE_FLAG_KEY, SCENE_MODES, SLS_MODULE_ID, SLS_FLAG_KEY, debug } from "./const.js";
import { buildFieldContext, resolvePresetPayload } from "./media.js";
import { getGlobalRawValues } from "./settings.js";

const NAME_PREFIX = `flags.${MODULE_ID}.${SCENE_FLAG_KEY}.values.`;
const MODE_FIELD = `flags.${MODULE_ID}.${SCENE_FLAG_KEY}.mode`;

/**
 * scene.getFlag() throws — rather than returning undefined — if the given
 * scope isn't a currently active, installed module. Since most tables
 * won't have Scene Loading Screens installed at all, checking
 * game.modules.get(...)?.active first is required, not optional; without
 * it, this throws for every table that doesn't run SLS, which is most of
 * them, and silently kills the whole tab injection with an unhandled
 * error caught by the outer try/catch instead of failing gracefully.
 */
function hasSlsConfigured(scene) {
  if (!game.modules.get(SLS_MODULE_ID)?.active) return false;
  return !!scene.getFlag(SLS_MODULE_ID, SLS_FLAG_KEY);
}

/**
 * Injects a "Game Master Screen" tab into Foundry's native Scene Config
 * sheet — Inherit (default) / Override / Disable, with an SLS-aware soft
 * default. Field names use flag dot-notation so core's own form
 * submission (Document#update via expandObject) writes them straight to
 * the scene's flags when the GM clicks Scene Config's own "Update Scene"
 * button — no separate save handler needed on our end.
 */
export function registerSceneConfigTab() {
  Hooks.on("renderSceneConfig", (app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    // injectTab is async — must catch its returned promise explicitly.
    // A bare try/catch around an unawaited async call only catches errors
    // thrown before its first `await`; anything failing after that
    // becomes a silent unhandled rejection that never reaches this log.
    injectTab(app, root).catch((err) => {
      console.error(`${MODULE_ID} | Failed to inject Scene Config tab`, err);
    });
  });
}

async function injectTab(app, root) {
  const scene = app.document;
  if (!scene) return;

  const nav = root.querySelector('nav[data-application-part="tabs"], nav.sheet-tabs');
  if (!nav) {
    debug("Scene Config: expected tab nav not found — skipping GMS tab injection");
    return;
  }

  // Scene Config's own "Apply" button re-renders the sheet in place rather
  // than closing/reopening it — renderSceneConfig fires again on the same
  // still-open sheet, and without this check, injectTab() would append a
  // second full copy of our nav link + section on top of the first every
  // time, stacking indefinitely. Remove any prior injection before adding
  // a fresh one, which also ensures the content reflects whatever changed
  // (e.g. Update Scene just wrote new flag values) rather than going stale.
  root.querySelector('a[data-tab="game-master-screen"]')?.remove();
  root.querySelector('section[data-tab="game-master-screen"]')?.remove();

  const stored = scene.getFlag(MODULE_ID, SCENE_FLAG_KEY) ?? null;
  const hasSLS = hasSlsConfigured(scene);

  // Soft default only — never a lock. Once a GM has explicitly saved a
  // mode for this scene (`stored` exists), that choice always wins over
  // the SLS-detection default, even if SLS is still configured too.
  const mode = stored?.mode ?? (hasSLS ? SCENE_MODES.DISABLE : SCENE_MODES.INHERIT);
  const values = stored?.values ?? getGlobalRawValues();
  const autoTriggerEnabled = game.settings.get(MODULE_ID, SETTINGS.TRIGGER_ON_SCENE_ACTIVATION);
  const showAutoTriggerOffWarning = !autoTriggerEnabled && mode === SCENE_MODES.INHERIT;

  const templateContext = {
    namePrefix: NAME_PREFIX,
    modeField: MODE_FIELD,
    isInherit: mode === SCENE_MODES.INHERIT,
    isOverride: mode === SCENE_MODES.OVERRIDE,
    isDisable: mode === SCENE_MODES.DISABLE,
    slsIsDefaulting: hasSLS && !stored,
    showAutoTriggerOffWarning,
    presets: game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [],
    ...buildFieldContext(values)
  };

  const contentHtml = await foundry.applications.handlebars.renderTemplate(
    `modules/${MODULE_ID}/templates/scene-config-tab.hbs`,
    templateContext
  );

  // Mirrors core's own tab-nav markup/attributes exactly, so Foundry's
  // existing delegated `data-action="tab"` click handling picks this up
  // with zero extra JS wiring on our end.
  const tabLink = document.createElement("a");
  tabLink.dataset.action = "tab";
  tabLink.dataset.group = "sheet";
  tabLink.dataset.tab = "game-master-screen";
  tabLink.innerHTML = `<i class="fa-solid fa-clapperboard" inert></i><span>${game.i18n.localize("GMS.SceneConfig.Tab")}</span>`;
  nav.appendChild(tabLink);

  // Content section — same wrapper pattern as core's own "misc"/"visibility"
  // tab sections. Inserted right after the LAST existing tab section
  // (not just appended to the container) — the sheet's footer (Save/
  // Apply buttons) is also a sibling in that same container, and a plain
  // appendChild lands after it instead of alongside the other tab panels.
  const existingSections = root.querySelectorAll('section.tab[data-group="sheet"]');
  const lastSection = existingSections[existingSections.length - 1];
  const tabsContainer = lastSection?.parentElement ?? nav.parentElement;

  const section = document.createElement("section");
  section.classList.add("tab");
  section.dataset.tab = "game-master-screen";
  section.dataset.group = "sheet";
  section.innerHTML = contentHtml;

  if (lastSection) {
    lastSection.after(section);
  } else {
    tabsContainer.appendChild(section);
  }

  wireTabBehavior(section, autoTriggerEnabled);

  // Because injectTab is async, Foundry's own "restore the previously
  // active tab" logic can run and finish BEFORE our tab exists in the DOM
  // — most noticeable on reopening the sheet when GMS was the last active
  // tab. Confirmed via testing: Foundry's internal active-tab state
  // already says "game-master-screen" in this case (restored from before
  // close), so a click — even a genuine .click() call, not just a
  // dispatched event — is treated as a no-op ("already active, nothing
  // to change") despite the section having never actually been shown,
  // since it didn't exist yet when that internal state was set. Rather
  // than fight that state machine, we set the one thing directly
  // confirmed from the live DOM ourselves: core marks the active nav
  // link with a literal `class="active"`, and Foundry's tab sections use
  // that same class for visibility. If nothing in the nav has it after
  // our injection, core never resolved an active tab at all — set it
  // directly on both our link and section rather than relying on
  // Foundry's click handling to do it for us.
  if (!nav.querySelector("a.active")) {
    tabLink.classList.add("active");
    section.classList.add("active");
  }
}

/**
 * Field-level behavior for the injected tab: mode radios show/hide the
 * Override block, the Override block's own media-mode radios show/hide
 * their section, browse buttons open the FilePicker, the volume slider
 * updates its live readout, and the preset dropdown loads a preset's
 * values into the fields as a one-time starting point (never wired back
 * to the preset afterward — this scene's override is its own copy).
 *
 * Deliberately self-contained rather than sharing GMSSettingsApp's
 * private field-wiring methods — those are scoped to that class's own
 * `this.element`/`this._applyMode` instance state, and duplicating this
 * modest amount of glue code here is lower-risk than threading a shared
 * helper through two different Application lifecycles.
 */
function wireTabBehavior(root, autoTriggerEnabled) {
  const applyMode = (mode) => {
    root.querySelectorAll(".gms-section").forEach((section) => {
      section.classList.toggle("gms-hidden", section.dataset.mode !== mode);
    });
  };
  const modeRadios = root.querySelectorAll(`input[name="${CSS.escape(NAME_PREFIX)}mediaMode"]`);
  modeRadios.forEach((radio) => {
    radio.addEventListener("change", () => applyMode(radio.value));
  });
  const checkedMode = root.querySelector(`input[name="${CSS.escape(NAME_PREFIX)}mediaMode"]:checked`);
  if (checkedMode) applyMode(checkedMode.value);

  // Top-level Inherit/Override/Disable — show the Override fields block
  // only when Override is actually selected, and keep the "global toggle
  // is off" warning in sync with whichever mode is currently selected —
  // it only ever applies to Inherit, since Override fires regardless of
  // that toggle and Disable never fires at all.
  const overrideBlock = root.querySelector(".gms-scene-override");
  const autoTriggerWarning = root.querySelector(".gms-auto-trigger-warning");
  root.querySelectorAll(`input[name="${CSS.escape(MODE_FIELD)}"]`).forEach((radio) => {
    radio.addEventListener("change", () => {
      overrideBlock?.classList.toggle("gms-hidden", radio.value !== SCENE_MODES.OVERRIDE || !radio.checked);
      if (radio.checked) {
        const showWarning = !autoTriggerEnabled && radio.value === SCENE_MODES.INHERIT;
        autoTriggerWarning?.classList.toggle("gms-hidden", !showWarning);
      }
    });
  });

  const FP = foundry.applications.apps.FilePicker.implementation;
  root.querySelectorAll(".gms-browse").forEach((button) => {
    button.addEventListener("click", () => {
      const targetName = button.dataset.target;
      const append = button.dataset.append === "true";
      const pickerType = button.dataset.type;

      new FP({
        type: pickerType,
        callback: (path) => {
          const field = root.querySelector(`[name="${CSS.escape(targetName)}"]`);
          if (!field) return;
          if (append) {
            field.value = field.value ? `${field.value}\n${path}` : path;
          } else {
            field.value = path;
          }
        }
      }).render(true);
    });
  });

  const volumeInput = root.querySelector(`input[name="${CSS.escape(NAME_PREFIX)}volume"]`);
  const volumeLabel = root.querySelector(".gms-volume-value");
  volumeInput?.addEventListener("input", () => {
    if (volumeLabel) volumeLabel.textContent = `${volumeInput.value}%`;
  });

  root.querySelector(".gms-preset-select")?.addEventListener("change", (event) => {
    const id = event.target.value;
    if (!id) return;
    const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [];
    const preset = presets.find((p) => p.id === id);
    if (preset) applyRawValuesToFields(root, preset.values, applyMode);
  });
}

/** Pushes a raw values object into this tab's own prefixed fields. */
function applyRawValuesToFields(root, values, applyMode) {
  const setVal = (field, v) => {
    const el = root.querySelector(`[name="${CSS.escape(NAME_PREFIX + field)}"]`);
    if (el) el.value = v;
  };
  const setChecked = (field, v) => {
    const el = root.querySelector(`[name="${CSS.escape(NAME_PREFIX + field)}"]`);
    if (el) el.checked = !!v;
  };

  const modeRadio = root.querySelector(`input[name="${CSS.escape(NAME_PREFIX)}mediaMode"][value="${values.mediaMode}"]`);
  if (modeRadio) modeRadio.checked = true;

  setVal("imagePath", values.imagePath ?? "");
  setVal("imageList", values.imageList ?? "");
  setVal("rotateInterval", values.rotateInterval ?? 10);
  setChecked("randomizeOrder", values.randomizeOrder);
  setVal("videoPath", values.videoPath ?? "");
  setVal("audioPath", values.audioPath ?? "");
  setVal("mediaFit", values.mediaFit ?? "contain");
  setChecked("loopMedia", values.loopMedia);
  setChecked("muteAudio", values.muteAudio);
  setVal("volume", values.volume ?? 50);
  setVal("duration", values.duration ?? 0);
  setVal("fadeIn", values.fadeIn ?? 0);
  setVal("fadeOut", values.fadeOut ?? 0);

  applyMode(values.mediaMode ?? "single");
  const volumeInput = root.querySelector(`input[name="${CSS.escape(NAME_PREFIX)}volume"]`);
  const volumeLabel = root.querySelector(".gms-volume-value");
  if (volumeInput && volumeLabel) volumeLabel.textContent = `${volumeInput.value}%`;
}

/** Reads a scene's saved mode/values, resolving SLS-aware default when unset. */
export function getSceneGmsMode(scene) {
  const stored = scene.getFlag(MODULE_ID, SCENE_FLAG_KEY) ?? null;
  if (stored?.mode) return stored.mode;
  return hasSlsConfigured(scene) ? SCENE_MODES.DISABLE : SCENE_MODES.INHERIT;
}

/** Resolves a scene's Override payload, or null if not in Override mode. */
export function resolveSceneOverridePayload(scene) {
  const stored = scene.getFlag(MODULE_ID, SCENE_FLAG_KEY) ?? null;
  if (stored?.mode !== SCENE_MODES.OVERRIDE || !stored.values) return null;
  return resolvePresetPayload(stored.values, scene.name);
}
