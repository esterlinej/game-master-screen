import { MODULE_ID, SETTINGS, MEDIA_MODES, MEDIA_FITS } from "./const.js";
import { showOverlay } from "./overlay.js";

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

  async _prepareContext() {
    const mode = game.settings.get(MODULE_ID, SETTINGS.MEDIA_MODE);
    const fit = game.settings.get(MODULE_ID, SETTINGS.MEDIA_FIT);
    const imageList = game.settings.get(MODULE_ID, SETTINGS.IMAGE_LIST) ?? [];
    return {
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
      fadeOut: game.settings.get(MODULE_ID, SETTINGS.FADE_OUT)
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
    // Media/Timing Configuration fieldsets (class gms-universal) are never
    // toggled here, since they apply regardless of which mode is selected.
    const applyMode = (mode) => {
      this.element.querySelectorAll(".gms-section").forEach((section) => {
        section.classList.toggle("gms-hidden", section.dataset.mode !== mode);
      });
    };

    const radios = this.element.querySelectorAll('input[name="mediaMode"]');
    radios.forEach((radio) => {
      radio.addEventListener("change", () => applyMode(radio.value));
    });
    const checked = this.element.querySelector('input[name="mediaMode"]:checked');
    applyMode(checked?.value ?? MEDIA_MODES.SINGLE);

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

    // Live percentage readout next to the volume slider
    const volumeInput = this.element.querySelector('input[name="volume"]');
    const volumeLabel = this.element.querySelector(".gms-volume-value");
    volumeInput?.addEventListener("input", () => {
      volumeLabel.textContent = `${volumeInput.value}%`;
    });
  }

  /** Reads the form's current (possibly unsaved) values into the same
   *  shape buildMediaPayload() produces, for the Preview button. */
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
      game.settings.set(MODULE_ID, SETTINGS.FADE_OUT, Number(data.fadeOut) || 0)
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
