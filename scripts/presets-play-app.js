import { MODULE_ID, SETTINGS } from "./const.js";
import { resolvePresetPayload } from "./media.js";
import { showGameMasterScreen } from "./core.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The "Presets" scene-controls tool — a lightweight popup listing saved
 * presets by name. A single click resolves that preset's stored values
 * and fires Game Master Screen directly with them, then closes itself.
 *
 * Deliberately ephemeral: this never touches the persisted global-default
 * settings (mediaMode, imagePath, etc.) at all, in either direction — it
 * doesn't load the preset into the Settings form, and doesn't require the
 * form to be open. It's a one-off override for this single trigger, same
 * spirit as a "play once" button. Renders in the same order presets are
 * stored/managed in via the Presets Manager (array position = display
 * order), so reordering there is reflected here automatically.
 */
export class GMSPresetsPlayApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "gms-presets-play",
    classes: ["gms-presets-play"],
    window: {
      title: "GMS.PresetsPlay.Title",
      icon: "fa-solid fa-list",
      resizable: true
    },
    position: { width: 320, height: "auto" },
    actions: {
      playPreset: GMSPresetsPlayApp._onPlay
    }
  };

  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/presets-play.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    // Keeps this popup in sync if presets are renamed/deleted/reordered via
    // the Presets Manager while this is also open.
    this._presetsHookId = Hooks.on(`${MODULE_ID}.presetsChanged`, () => this.render(true));
  }

  async close(options) {
    Hooks.off(`${MODULE_ID}.presetsChanged`, this._presetsHookId);
    return super.close(options);
  }

  async _prepareContext() {
    const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [];
    return { presets, hasPresets: presets.length > 0 };
  }

  static async _onPlay(_event, target) {
    const id = target.dataset.presetId ?? target.closest("[data-preset-id]")?.dataset.presetId;
    const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [];
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;

    const mediaData = resolvePresetPayload(preset.values, preset.name);
    await showGameMasterScreen(mediaData);
    this.close();
  }
}
