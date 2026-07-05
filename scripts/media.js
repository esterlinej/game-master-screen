import { MODULE_ID, SETTINGS, MEDIA_MODES } from "./const.js";

/**
 * Pure resolver: takes a raw values object — one-to-one with the SETTINGS
 * keys, the same shape both the persisted world settings and a saved
 * preset's `values` are stored as — and resolves it into the broadcast-
 * ready payload (mode collapsed into type+images/src, list shuffled if
 * randomized). Shared by buildMediaPayload() (reads from game.settings)
 * and resolvePresetPayload() (reads from a preset), so there's exactly
 * one place that knows how to turn "raw config" into "what actually shows
 * on screen" — rather than three copies of this logic drifting apart.
 *
 * `imageList` must already be an array here; callers normalize their own
 * source format (world setting is stored as an array already, a preset's
 * raw value is a newline-joined string) before calling in.
 */
export function resolveMediaPayload({
  mediaMode,
  imagePath,
  imageList,
  rotateInterval,
  randomizeOrder,
  videoPath,
  audioPath,
  mediaFit,
  loopMedia,
  muteAudio,
  volume,
  duration,
  fadeIn,
  fadeOut
}) {
  const universal = {
    audioSrc: audioPath || null,
    fit: mediaFit,
    loop: !!loopMedia,
    muted: !!muteAudio,
    volume: Math.min(1, Math.max(0, Number(volume) / 100)),
    duration: Number(duration) || 0,
    fadeIn: Number(fadeIn) || 0,
    fadeOut: Number(fadeOut) || 0
  };

  if (mediaMode === MEDIA_MODES.VIDEO) {
    return { ...universal, type: "video", src: videoPath };
  }

  if (mediaMode === MEDIA_MODES.LIST) {
    const list = Array.isArray(imageList) ? imageList : [];
    if (list.length <= 1) {
      return { ...universal, type: "image", images: list, rotateInterval: null };
    }
    const images = randomizeOrder ? shuffle([...list]) : [...list];
    return { ...universal, type: "image", images, rotateInterval: Number(rotateInterval) || 10 };
  }

  // MEDIA_MODES.SINGLE
  return { ...universal, type: "image", images: [imagePath], rotateInterval: null };
}

/**
 * Build the media payload broadcast to all clients when GMS is triggered
 * from the current persisted world settings (the global default). Resolved
 * once, at trigger time, by the initiating GM client — everyone else just
 * renders whatever they're told, so all clients share exactly one resolved
 * (and, if randomized, shuffled) order per trigger.
 */
export async function buildMediaPayload() {
  return resolveMediaPayload({
    mediaMode: game.settings.get(MODULE_ID, SETTINGS.MEDIA_MODE),
    imagePath: game.settings.get(MODULE_ID, SETTINGS.IMAGE_PATH),
    imageList: game.settings.get(MODULE_ID, SETTINGS.IMAGE_LIST) ?? [],
    rotateInterval: game.settings.get(MODULE_ID, SETTINGS.ROTATE_INTERVAL),
    randomizeOrder: game.settings.get(MODULE_ID, SETTINGS.RANDOMIZE_ORDER),
    videoPath: game.settings.get(MODULE_ID, SETTINGS.VIDEO_PATH),
    audioPath: game.settings.get(MODULE_ID, SETTINGS.AUDIO_PATH),
    mediaFit: game.settings.get(MODULE_ID, SETTINGS.MEDIA_FIT),
    loopMedia: game.settings.get(MODULE_ID, SETTINGS.LOOP_MEDIA),
    muteAudio: game.settings.get(MODULE_ID, SETTINGS.MUTE_AUDIO),
    volume: game.settings.get(MODULE_ID, SETTINGS.VOLUME),
    duration: game.settings.get(MODULE_ID, SETTINGS.DURATION),
    fadeIn: game.settings.get(MODULE_ID, SETTINGS.FADE_IN),
    fadeOut: game.settings.get(MODULE_ID, SETTINGS.FADE_OUT)
  });
}

/**
 * Resolve a saved preset's raw `values` (the same shape
 * GMSSettingsApp#_gatherRawFormValues produces — imageList is a
 * newline-joined string there, not an array) into a broadcast-ready
 * payload. Used by the Presets toolbar tool to fire a preset directly,
 * without touching or reading the persisted world settings at all —
 * a one-off, ephemeral override rather than a change to the global
 * default.
 */
export function resolvePresetPayload(values) {
  const imageList = String(values.imageList ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return resolveMediaPayload({ ...values, imageList });
}

/** Fisher–Yates — operates on the copy passed in, returns it for convenience. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
