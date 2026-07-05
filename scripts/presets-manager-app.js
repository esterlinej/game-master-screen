import { MODULE_ID, SETTINGS } from "./const.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class GMSPresetsManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "gms-presets-manager",
    classes: ["gms-presets-manager"],
    window: {
      title: "GMS.Presets.Title",
      icon: "fa-solid fa-list",
      resizable: true
    },
    position: { width: 420, height: "auto" },
    actions: {
      renamePreset: GMSPresetsManagerApp._onRename,
      deletePreset: GMSPresetsManagerApp._onDelete
    }
  };

  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/presets-manager.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    this._hookId = Hooks.on(`${MODULE_ID}.presetsChanged`, () => this.render(true));
  }

  async close(options) {
    Hooks.off(`${MODULE_ID}.presetsChanged`, this._hookId);
    return super.close(options);
  }

  async _prepareContext() {
    const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [];
    return { presets, hasPresets: presets.length > 0 };
  }

  static async _onRename(_event, target) {
    const id = target.dataset.presetId;
    const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [];
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;

    const newName = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Rename Preset" },
      content: `
        <div class="form-group">
          <label>Preset Name</label>
          <div class="form-fields">
            <input type="text" name="presetName" value="${preset.name}" autofocus required />
          </div>
        </div>`,
      ok: {
        label: "Rename",
        callback: (event, button) => button.form.elements.presetName?.value?.trim() || null
      },
      rejectClose: false
    });
    if (!newName) return;

    preset.name = newName;
    await game.settings.set(MODULE_ID, SETTINGS.PRESETS, presets);
    Hooks.callAll(`${MODULE_ID}.presetsChanged`);
  }

  static async _onDelete(_event, target) {
    const id = target.dataset.presetId;
    const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [];
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;

    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Preset" },
      content: `<p>Delete the preset "<strong>${preset.name}</strong>"? This cannot be undone.</p>`,
      rejectClose: false,
      modal: true
    });
    if (!proceed) return;

    const updated = presets.filter((p) => p.id !== id);
    await game.settings.set(MODULE_ID, SETTINGS.PRESETS, updated);
    Hooks.callAll(`${MODULE_ID}.presetsChanged`);
  }
}
