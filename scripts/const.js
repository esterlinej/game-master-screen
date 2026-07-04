export const MODULE_ID = "game-master-screen";

/** Socket channel name, namespaced under the module id per Foundry convention */
export const SOCKET_NAME = `module.${MODULE_ID}`;

/** Socket action types */
export const ACTIONS = {
  SHOW: "show",
  CLOSE: "close"
};

/** The three mutually-exclusive media modes, replacing the old type+checkbox split */
export const MEDIA_MODES = {
  SINGLE: "single",
  LIST: "list",
  VIDEO: "video"
};

/** How picture/video content fits the screen — maps to CSS object-fit */
export const MEDIA_FITS = {
  CONTAIN: "contain",
  COVER: "cover",
  STRETCH: "stretch",
  ORIGINAL: "original"
};

/** Setting keys */
export const SETTINGS = {
  MEDIA_MODE: "mediaMode",       // "single" | "list" | "video" — see MEDIA_MODES
  IMAGE_PATH: "imagePath",       // used when mode === SINGLE
  IMAGE_LIST: "imageList",       // ordered array of image paths, used when mode === LIST
  ROTATE_INTERVAL: "rotateInterval", // seconds, used when mode === LIST
  RANDOMIZE_ORDER: "randomizeOrder", // bool — shuffle imageList at trigger time
  VIDEO_PATH: "videoPath",       // used when mode === VIDEO

  // Universal — apply regardless of which media mode is active
  AUDIO_PATH: "audioPath",       // optional — plays alongside ANY mode; if set
                                  // while mode === VIDEO, the video's own audio
                                  // is forced muted so this is the sole source
  MEDIA_FIT: "mediaFit",         // see MEDIA_FITS — how picture/video fills the screen
  LOOP_MEDIA: "loopMedia",       // bool — loop video/audio playback
  MUTE_AUDIO: "muteAudio",       // bool — mute video/audio; unmuted by default
  VOLUME: "volume",              // 0–100, playback volume for video and audio
  DURATION: "duration",          // seconds; 0/empty = requires GM to close manually
  FADE_IN: "fadeIn",             // ms
  FADE_OUT: "fadeOut",           // ms

  TRIGGER_ON_SCENE_ACTIVATION: "triggerOnSceneActivation", // bool

  GMS_ACTIVE: "gmsActive",       // world-scope state flag, not user-facing config
  GMS_ACTIVE_MEDIA: "gmsActiveMedia", // world-scope — the media payload currently
                                       // showing, so a client connecting mid-GMS
                                       // (late join, reload, reconnect) can catch
                                       // up instead of only reacting to the live
                                       // broadcast moment
  DEBUG: "debug"                 // client-scope, user-toggleable debug logging
};

/**
 * Logs to console AND shows an on-screen notification when the user has
 * debug mode enabled — modeled on Scene-Loading-Screens' debug() helper,
 * but extended to not depend on DevTools being usable at all. This matters
 * because we currently can't confirm whether Foundry Lightweight Client's
 * WebView console actually works for a given user; an on-screen toast is
 * visible regardless.
 */
export function debug(...args) {
  try {
    if (!game?.settings?.get(MODULE_ID, "debug")) return;
  } catch (_) {
    return; // settings not registered yet — stay silent, same as their guard
  }
  console.log(`${MODULE_ID} |`, ...args);
  const message = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  ui.notifications?.info(`[GMS debug] ${message}`);
}
