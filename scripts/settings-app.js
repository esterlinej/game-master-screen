import { MODULE_ID, SETTINGS, MEDIA_MODES, MEDIA_FITS } from "./const.js";
import { showOverlay } from "./overlay.js";
import { GMSPresetsManagerApp } from "./presets-manager-app.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class GMSSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "gms-settings",
    tag: "form",
    window: {
      title: "GMS.Settings.Title",
      icon: "fa-solid fa-clapperboard"
    },
    position: {
      width: 480
    },
    form: {
      handler: GMSSettingsApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/settings.hbs` }
  };

  constructor(options = {}) {
    super(options);
    // Keeps the preset dropdown in sync if a preset is renamed/deleted via
    // the Presets Manager while this form is also open.
    this._presetsHookId = Hooks.on(`${MODULE_ID}.presetsChanged`, () => this.render(true));
  }

  async close(options) {
    Hooks.off(`${MODULE_ID}.presetsChanged`, this._presetsHookId);
    return super.close(options);
  }

  async _prepareContext() {
    const mode = game.settings.get(MODULE_ID, SETTINGS.MEDIA_MODE);
    const fit = game.settings.get(MODULE_ID, SETTINGS.MEDIA_FIT);
    const imageList = game.settings.get(MODULE_ID, SETTINGS.IMAGE_LIST) ?? [];
    return {
      presets: game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [],
      isSingle: mode === MEDIA_MODES.SINGLE,
      isList: mode === MEDIA_MODES.LIST,
      isVideo: mode === MEDIA_MODES.VIDEO,
      imagePath: game.settings.get(MODULE_ID, SETTINGS.IMAGE_PATH),
      imageListText: imageList.join("\n"),
      rotateInterval: game.settings.get(MODULE_ID, SETTINGS.ROTATE_INTERVAL),
      randomizeOrder: game.settings.get(MODULE_ID, SETTINGS.RANDOMIZE_ORDER),
      videoPath: game.settings.get(MODULE_ID, SETTINGS.VIDEO_PATH),
      audioPath: game.settings.get(MODULE_ID, SETTINGS.AUDIO_PATH),
      fitContain: fit === MEDIA_FITS.CONTAIN,
      fitCover: fit === MEDIA_FITS.COVER,
      fitStretch: fit === MEDIA_FITS.STRETCH,
      fitOriginal: fit === MEDIA_FITS.ORIGINAL,
      loopMedia: game.settings.get(MODULE_ID, SETTINGS.LOOP_MEDIA),
      muteAudio: game.settings.get(MODULE_ID, SETTINGS.MUTE_AUDIO),
      volume: game.settings.get(MODULE_ID, SETTINGS.VOLUME),
      duration: game.settings.get(MODULE_ID, SETTINGS.DURATION),
      fadeIn: game.settings.get(MODULE_ID, SETTINGS.FADE_IN),
      fadeOut: game.settings.get(MODULE_ID, SETTINGS.FADE_OUT),
      triggerOnSceneActivation: game.settings.get(MODULE_ID, SETTINGS.TRIGGER_ON_SCENE_ACTIVATION)
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Prevent keystrokes inside this form from bubbling up to Foundry's
    // global keybinding handler — otherwise typing a space or activating a
    // focused button with the keyboard can double-fire core's pause hotkey.
    this.element.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });

    // Live show/hide of the mode-specific sections only — the universal
    // fieldsets (class gms-universal) are never toggled here, since they
    // apply regardless of which mode is selected. Exposed on `this` so
    // preset-loading can call it too after swapping the mode radio.
    this._applyMode = (mode) => {
      this.element.querySelectorAll(".gms-section").forEach((section) => {
        section.classList.toggle("gms-hidden", section.dataset.mode !== mode);
      });
    };

    const radios = this.element.querySelectorAll('input[name="mediaMode"]');
    radios.forEach((radio) => {
      radio.addEventListener("change", () => this._applyMode(radio.value));
    });
    const checkedRadio = this.element.querySelector('input[name="mediaMode"]:checked');
    this._applyMode(checkedRadio?.value ?? MEDIA_MODES.SINGLE);

    // Browse buttons — foundry.applications.apps.FilePicker.implementation
    // is the officially-supported getter for whichever FilePicker class is
    // currently configured (core default, or a module override).
    const FP = foundry.applications.apps.FilePicker.implementation;

    this.element.querySelectorAll(".gms-browse").forEach((button) => {
      button.addEventListener("click", () => {
        const targetName = button.dataset.target;
        const append = button.dataset.append === "true";
        const pickerType = button.dataset.type; // "image" | "video" | "audio"

        new FP({
          type: pickerType,
          callback: (path) => {
            const field = this.element.querySelector(`[name="${targetName}"]`);
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

    // Preview — renders locally on this GM's own client only, using
    // whatever's currently typed in the form (not yet saved). No socket
    // broadcast, no gmsActive flag change; click anywhere to dismiss.
    this.element.querySelector(".gms-preview")?.addEventListener("click", () => {
      const mediaData = this._gatherFormMedia();
      showOverlay(mediaData, { preview: true });
    });

    // Live percentage readout next to the volume slider. Exposed on `this`
    // so preset-loading can refresh it after setting the slider's value.
    const volumeInput = this.element.querySelector('input[name="volume"]');
    const volumeLabel = this.element.querySelector(".gms-volume-value");
    this._updateVolumeLabel = () => {
      if (volumeInput && volumeLabel) volumeLabel.textContent = `${volumeInput.value}%`;
    };
    volumeInput?.addEventListener("input", () => this._updateVolumeLabel());

    // Preset dropdown — loads a saved preset's values into the form live,
    // in-memory only. Nothing is persisted as the active global default
    // until Save is actually clicked, same as any other field edit.
    this.element.querySelector(".gms-preset-select")?.addEventListener("change", (event) => {
      const id = event.target.value;
      if (!id) return; // "— Custom —" selected, nothing to load
      const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [];
      const preset = presets.find((p) => p.id === id);
      if (preset) this._applyValuesToForm(preset.values);
    });

    // Opens the standalone Presets Manager for rename/delete.
    this.element.querySelector(".gms-manage-presets")?.addEventListener("click", () => {
      new GMSPresetsManagerApp().render(true);
    });

    // Save as Preset — captures the form's current raw values (not the
    // resolved Preview payload) under a name, so the mode/list/randomize
    // choices are preserved exactly rather than collapsed into one
    // resolved outcome. Context-aware: if a preset is currently selected
    // in the dropdown, offers to update it in place rather than only ever
    // creating a new one — Save itself stays simple (always commits as the
    // global default, regardless of preset selection); this button is
    // where preset-specific update-vs-create lives instead.
    this.element.querySelector(".gms-save-preset")?.addEventListener("click", async () => {
      const selectedId = this.element.querySelector(".gms-preset-select")?.value;
      const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [];
      const selectedPreset = selectedId ? presets.find((p) => p.id === selectedId) : null;

      let mode = "create";
      if (selectedPreset) {
        mode = await foundry.applications.api.DialogV2.wait({
          window: { title: "Save as Preset" },
          content: `<p>Update the existing preset "<strong>${selectedPreset.name}</strong>", or save these values as a new preset?</p>`,
          buttons: [
            { action: "update", label: `Update "${selectedPreset.name}"`, default: true },
            { action: "create", label: "Save as New Preset..." }
          ],
          rejectClose: false
        });
        if (!mode) return; // dialog dismissed
      }

      if (mode === "update") {
        selectedPreset.values = this._gatherRawFormValues();
        await game.settings.set(MODULE_ID, SETTINGS.PRESETS, presets);
        Hooks.callAll(`${MODULE_ID}.presetsChanged`);
        ui.notifications.info(`Updated preset "${selectedPreset.name}".`);
        return;
      }

      const name = await foundry.applications.api.DialogV2.prompt({
        window: { title: "Save as Preset" },
        content: `
          <div class="form-group">
            <label>Preset Name</label>
            <div class="form-fields">
              <input type="text" name="presetName" autofocus required />
            </div>
          </div>`,
        ok: {
          label: "Save",
          callback: (evt, button) => button.form.elements.presetName?.value?.trim() || null
        },
        rejectClose: false
      });
      if (!name) return;

      presets.push({
        id: foundry.utils.randomID(),
        name,
        values: this._gatherRawFormValues()
      });
      await game.settings.set(MODULE_ID, SETTINGS.PRESETS, presets);
      Hooks.callAll(`${MODULE_ID}.presetsChanged`);
      ui.notifications.info(`Saved preset "${name}".`);
    });
  }

  /** Reads the form's current (possibly unsaved) values into the same
   *  shape buildMediaPayload() produces, for the Preview button. This is
   *  a RESOLVED/display-ready payload (rotation shuffled, mode collapsed
   *  into type+images) — not suitable for round-tripping back into the
   *  form, which is what _gatherRawFormValues() below is for instead. */
  _gatherFormMedia() {
    const el = this.element;
    const val = (name) => el.querySelector(`[name="${name}"]`)?.value ?? "";
    const isChecked = (name) => !!el.querySelector(`[name="${name}"]`)?.checked;
    const mode = el.querySelector('input[name="mediaMode"]:checked')?.value ?? MEDIA_MODES.SINGLE;

    const universal = {
      audioSrc: val("audioPath") || null,
      fit: val("mediaFit") || MEDIA_FITS.CONTAIN,
      loop: isChecked("loopMedia"),
      muted: isChecked("muteAudio"),
      volume: Math.min(1, Math.max(0, Number(val("volume")) / 100)),
      duration: Number(val("duration")) || 0,
      fadeIn: Number(val("fadeIn")) || 0,
      fadeOut: Number(val("fadeOut")) || 0
    };

    if (mode === MEDIA_MODES.VIDEO) {
      return { ...universal, type: "video", src: val("videoPath") };
    }

    if (mode === MEDIA_MODES.LIST) {
      const list = val("imageList").split("\n").map((s) => s.trim()).filter(Boolean);
      if (list.length <= 1) {
        return { ...universal, type: "image", images: list, rotateInterval: null };
      }
      const images = isChecked("randomizeOrder") ? shuffle([...list]) : [...list];
      return { ...universal, type: "image", images, rotateInterval: Number(val("rotateInterval")) || 10 };
    }

    return { ...universal, type: "image", images: [val("imagePath")], rotateInterval: null };
  }

  /** Reads the form's current raw field values, one-to-one with the
   *  SETTINGS keys — the shape a preset is stored as, and round-trips
   *  cleanly back into the form via _applyValuesToForm() below. Excludes
   *  triggerOnSceneActivation deliberately: that's a structural on/off for
   *  the whole automatic-trigger feature, not part of "which look" a
   *  preset represents. */
  _gatherRawFormValues() {
    const el = this.element;
    const val = (name) => el.querySelector(`[name="${name}"]`)?.value ?? "";
    const isChecked = (name) => !!el.querySelector(`[name="${name}"]`)?.checked;

    return {
      mediaMode: el.querySelector('input[name="mediaMode"]:checked')?.value ?? MEDIA_MODES.SINGLE,
      imagePath: val("imagePath"),
      imageList: val("imageList"),
      rotateInterval: Number(val("rotateInterval")) || 10,
      randomizeOrder: isChecked("randomizeOrder"),
      videoPath: val("videoPath"),
      audioPath: val("audioPath"),
      mediaFit: val("mediaFit") || MEDIA_FITS.CONTAIN,
      loopMedia: isChecked("loopMedia"),
      muteAudio: isChecked("muteAudio"),
      volume: Number(val("volume")) || 0,
      duration: Number(val("duration")) || 0,
      fadeIn: Number(val("fadeIn")) || 0,
      fadeOut: Number(val("fadeOut")) || 0
    };
  }

  /** Reverse of _gatherRawFormValues() — pushes a saved preset's values
   *  back into the form's actual fields, then re-runs the mode-visibility
   *  and volume-label logic so the UI reflects the load immediately. */
  _applyValuesToForm(values) {
    const el = this.element;
    const setVal = (name, v) => {
      const field = el.querySelector(`[name="${name}"]`);
      if (field) field.value = v;
    };
    const setChecked = (name, v) => {
      const field = el.querySelector(`[name="${name}"]`);
      if (field) field.checked = !!v;
    };

    const modeRadio = el.querySelector(`input[name="mediaMode"][value="${values.mediaMode}"]`);
    if (modeRadio) modeRadio.checked = true;

    setVal("imagePath", values.imagePath ?? "");
    setVal("imageList", values.imageList ?? "");
    setVal("rotateInterval", values.rotateInterval ?? 10);
    setChecked("randomizeOrder", values.randomizeOrder);
    setVal("videoPath", values.videoPath ?? "");
    setVal("audioPath", values.audioPath ?? "");
    setVal("mediaFit", values.mediaFit ?? MEDIA_FITS.CONTAIN);
    setChecked("loopMedia", values.loopMedia);
    setChecked("muteAudio", values.muteAudio);
    setVal("volume", values.volume ?? 50);
    setVal("duration", values.duration ?? 0);
    setVal("fadeIn", values.fadeIn ?? 0);
    setVal("fadeOut", values.fadeOut ?? 0);

    this._applyMode?.(values.mediaMode ?? MEDIA_MODES.SINGLE);
    this._updateVolumeLabel?.();
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    const imageList = String(data.imageList ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    await Promise.all([
      game.settings.set(MODULE_ID, SETTINGS.MEDIA_MODE, data.mediaMode),
      game.settings.set(MODULE_ID, SETTINGS.IMAGE_PATH, data.imagePath),
      game.settings.set(MODULE_ID, SETTINGS.IMAGE_LIST, imageList),
      game.settings.set(MODULE_ID, SETTINGS.RANDOMIZE_ORDER, !!data.randomizeOrder),
      game.settings.set(MODULE_ID, SETTINGS.ROTATE_INTERVAL, Number(data.rotateInterval) || 10),
      game.settings.set(MODULE_ID, SETTINGS.VIDEO_PATH, data.videoPath),
      game.settings.set(MODULE_ID, SETTINGS.AUDIO_PATH, data.audioPath),
      game.settings.set(MODULE_ID, SETTINGS.MEDIA_FIT, data.mediaFit),
      game.settings.set(MODULE_ID, SETTINGS.LOOP_MEDIA, !!data.loopMedia),
      game.settings.set(MODULE_ID, SETTINGS.MUTE_AUDIO, !!data.muteAudio),
      game.settings.set(MODULE_ID, SETTINGS.VOLUME, Number(data.volume) || 0),
      game.settings.set(MODULE_ID, SETTINGS.DURATION, Number(data.duration) || 0),
      game.settings.set(MODULE_ID, SETTINGS.FADE_IN, Number(data.fadeIn) || 0),
      game.settings.set(MODULE_ID, SETTINGS.FADE_OUT, Number(data.fadeOut) || 0),
      game.settings.set(MODULE_ID, SETTINGS.TRIGGER_ON_SCENE_ACTIVATION, !!data.triggerOnSceneActivation)
    ]);
  }
}

/** Fisher–Yates — same as media.js's private helper, duplicated here since
 *  Preview needs to shuffle unsaved form state, not persisted settings. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
