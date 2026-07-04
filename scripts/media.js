import { MODULE_ID, SETTINGS, MEDIA_MODES } from "./const.js";

/**
 * Build the media payload broadcast to all clients when GMS is triggered.
 * Resolved once, at trigger time, by the initiating GM client — everyone
 * else just renders whatever they're told, so all clients share exactly
 * one resolved (and, if randomized, shuffled) order per trigger.
 *
 * Audio, fit, and timing are universal — they apply regardless of which
 * media mode is active, rather than being nested under Video specifically.
 */
export async function buildMediaPayload() {
  const mode = game.settings.get(MODULE_ID, SETTINGS.MEDIA_MODE);

  const universal = {
    audioSrc: game.settings.get(MODULE_ID, SETTINGS.AUDIO_PATH) || null,
    fit: game.settings.get(MODULE_ID, SETTINGS.MEDIA_FIT),
    loop: game.settings.get(MODULE_ID, SETTINGS.LOOP_MEDIA),
    muted: game.settings.get(MODULE_ID, SETTINGS.MUTE_AUDIO),
    volume: Math.min(1, Math.max(0, Number(game.settings.get(MODULE_ID, SETTINGS.VOLUME)) / 100)),
    duration: Number(game.settings.get(MODULE_ID, SETTINGS.DURATION)) || 0,
    fadeIn: Number(game.settings.get(MODULE_ID, SETTINGS.FADE_IN)) || 0,
    fadeOut: Number(game.settings.get(MODULE_ID, SETTINGS.FADE_OUT)) || 0
  };

  if (mode === MEDIA_MODES.VIDEO) {
    return {
      ...universal,
      type: "video",
      src: game.settings.get(MODULE_ID, SETTINGS.VIDEO_PATH)
    };
  }

  if (mode === MEDIA_MODES.LIST) {
    const list = game.settings.get(MODULE_ID, SETTINGS.IMAGE_LIST) ?? [];
    if (list.length <= 1) {
      return { ...universal, type: "image", images: list, rotateInterval: null };
    }
    const randomize = game.settings.get(MODULE_ID, SETTINGS.RANDOMIZE_ORDER);
    const images = randomize ? shuffle([...list]) : [...list];
    return {
      ...universal,
      type: "image",
      images,
      rotateInterval: game.settings.get(MODULE_ID, SETTINGS.ROTATE_INTERVAL)
    };
  }

  // MEDIA_MODES.SINGLE
  return {
    ...universal,
    type: "image",
    images: [game.settings.get(MODULE_ID, SETTINGS.IMAGE_PATH)],
    rotateInterval: null
  };
}

/** Fisher–Yates — operates on the copy passed in, returns it for convenience. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
