import { MODULE_ID, SETTINGS, MEDIA_MODES, MEDIA_FITS } from "./const.js";
import { GMSSettingsApp } from "./settings-app.js";

/**
 * Register all world-scope settings for the module.
 * Called from the `init` hook in main.js.
 */
export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.MEDIA_MODE, {
    scope: "world",
    config: false,
    type: String,
    choices: {
      [MEDIA_MODES.SINGLE]: "Single Image",
      [MEDIA_MODES.LIST]: "Image List (Rotating)",
      [MEDIA_MODES.VIDEO]: "Video"
    },
    default: MEDIA_MODES.SINGLE
  });

  game.settings.register(MODULE_ID, SETTINGS.IMAGE_PATH, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, SETTINGS.IMAGE_LIST, {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, SETTINGS.ROTATE_INTERVAL, {
    scope: "world",
    config: false,
    type: Number,
    default: 10 // seconds
  });

  game.settings.register(MODULE_ID, SETTINGS.RANDOMIZE_ORDER, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.VIDEO_PATH, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  // Universal — apply regardless of media mode
  game.settings.register(MODULE_ID, SETTINGS.AUDIO_PATH, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, SETTINGS.MEDIA_FIT, {
    scope: "world",
    config: false,
    type: String,
    choices: {
      [MEDIA_FITS.CONTAIN]: "Contain (fit inside, may show borders)",
      [MEDIA_FITS.COVER]: "Cover (fill screen, may crop)",
      [MEDIA_FITS.STRETCH]: "Stretch (fill screen, may distort)",
      [MEDIA_FITS.ORIGINAL]: "Original size (centred)"
    },
    default: MEDIA_FITS.CONTAIN
  });

  game.settings.register(MODULE_ID, SETTINGS.LOOP_MEDIA, {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.MUTE_AUDIO, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.VOLUME, {
    scope: "world",
    config: false,
    type: Number,
    default: 50
  });

  game.settings.register(MODULE_ID, SETTINGS.DURATION, {
    scope: "world",
    config: false,
    type: Number,
    default: 0 // 0 = manual close
  });

  game.settings.register(MODULE_ID, SETTINGS.FADE_IN, {
    scope: "world",
    config: false,
    type: Number,
    default: 1500
  });

  game.settings.register(MODULE_ID, SETTINGS.FADE_OUT, {
    scope: "world",
    config: false,
    type: Number,
    default: 2500
  });

  game.settings.register(MODULE_ID, SETTINGS.TRIGGER_ON_SCENE_ACTIVATION, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  // Internal state flag — world-scoped so it syncs to every client (incl.
  // a second GM account on another monitor) without a bespoke socket ping.
  // Not exposed in any settings UI.
  game.settings.register(MODULE_ID, SETTINGS.GMS_ACTIVE, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.GMS_ACTIVE_MEDIA, {
    scope: "world",
    config: false,
    type: Object,
    default: null
  });

  // Client-scope, user-toggleable debug logging — visible in core's normal
  // Configure Settings list so any user (including Christophe) can enable
  // it themselves without needing us to walk them through anything.
  game.settings.register(MODULE_ID, SETTINGS.DEBUG, {
    name: "GMS.Settings.DebugName",
    hint: "GMS.Settings.DebugHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  // Second entry point into the same settings form, alongside the scene
  // controls "Settings" tool — same pattern Scene-Loading-Screens uses for
  // its Presets manager.
  game.settings.registerMenu(MODULE_ID, "settingsMenu", {
    name: "GMS.Settings.Title",
    label: "GMS.Settings.Title",
    hint: "GMS.Settings.Hint",
    icon: "fa-solid fa-clapperboard",
    type: GMSSettingsApp,
    restricted: true
  });
}
