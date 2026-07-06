import { MODULE_ID, SETTINGS, SCENE_MODES, debug } from "./const.js";
import { showGameMasterScreen } from "./core.js";
import { getSceneGmsMode, resolveSceneOverridePayload } from "./scene-config-tab.js";

let pausedPlaylistId = null;

/**
 * Auto-triggers GMS whenever a scene is activated (not just viewed —
 * `scene.activate()` specifically, the GM's "Activate" button, which sets
 * `active: true` on the Scene document and syncs it to all clients).
 *
 * `updateScene` fires identically on every connected client, GM and player
 * alike, since Foundry syncs the document change to everyone. Only the GM's
 * own client should actually call showGameMasterScreen() — otherwise every
 * player client would independently try to trigger it too. If more than one
 * GM account is connected, showGameMasterScreen()'s own gmsActive guard
 * already no-ops the duplicate rather than double-firing.
 *
 * This is a reactive hook: it fires after the activation already happened,
 * not before. That means there's a small chance a player briefly sees
 * Foundry's own scene-load flicker before this overlay fully covers it —
 * a real but minor visual tradeoff of the simpler reactive approach,
 * versus proactively wrapping the Activate action itself.
 *
 * Per-scene mode (Inherit/Override/Disable, set via the Scene Config tab)
 * is checked before anything else: Disable means GMS never triggers for
 * this scene, full stop — global auto-trigger setting or not, and no
 * playlist silencing either, since nothing is showing to cover the audio
 * gap. Override resolves the scene's own saved values instead of the
 * global default. Inherit (or no scene flag at all) is today's behavior.
 */
export function registerSceneActivationTrigger() {
  Hooks.on("updateScene", (scene, changes) => {
    if (!game.user.isGM) return;
    if (changes.active !== true) return;

    const mode = getSceneGmsMode(scene);
    if (mode === SCENE_MODES.DISABLE) {
      debug(`scene "${scene.name}" activated — GMS disabled for this scene, skipping entirely`);
      return;
    }

    // Override is this scene's own explicit "always fire here" choice —
    // independent of the global toggle, which only governs Inherit's
    // default behavior. Gating Override behind the same toggle meant for
    // the global default made it impossible to have GMS fire on this one
    // scene without also turning on auto-trigger everywhere else.
    if (mode === SCENE_MODES.OVERRIDE) {
      const overridePayload = resolveSceneOverridePayload(scene);
      debug(`scene "${scene.name}" activated — auto-triggering with scene Override config`);
      showGameMasterScreen(overridePayload);
      armPlaylistSilencing(scene);
      return;
    }

    // Inherit (or no scene flag at all) — this is the actual behavior the
    // global toggle controls.
    if (!game.settings.get(MODULE_ID, SETTINGS.TRIGGER_ON_SCENE_ACTIVATION)) return;

    debug(`scene "${scene.name}" activated — auto-triggering Game Master Screen`);
    showGameMasterScreen();
    armPlaylistSilencing(scene);
  });

  // Foundry's own scene-playlist auto-play doesn't necessarily start in the
  // same tick as the updateScene hook above — it appears tied more closely
  // to the scene's canvas/texture load actually completing, which happens
  // a beat later. canvasReady is a second, more likely-correct checkpoint
  // to catch it, alongside the staggered re-checks in armPlaylistSilencing.
  Hooks.on("canvasReady", () => {
    if (!pausedPlaylistId) return;
    const playlist = game.playlists.get(pausedPlaylistId);
    if (playlist) stopIfStillArmed(playlist);
  });

  // Playlist documents are shared/synced like any other Foundry document —
  // calling stopAll()/playAll() propagates to every connected client on its
  // own, no socket messaging of our own required. Delayed by the fade-out
  // duration so the scene's own audio doesn't overlap GMS's own fade —
  // it kicks back in right as GMS finishes disappearing, not the instant
  // Close is clicked.
  Hooks.on(`${MODULE_ID}.closed`, (mediaData) => {
    if (!pausedPlaylistId || !game.user.isGM) return;
    const playlist = game.playlists.get(pausedPlaylistId);
    pausedPlaylistId = null;
    if (!playlist) return;

    const fadeOutMs = Math.max(0, Number(mediaData?.fadeOut) || 0);
    debug(`resuming scene playlist "${playlist.name}" in ${fadeOutMs}ms, once GMS finishes fading out`);
    setTimeout(() => playlist.playAll(), fadeOutMs);
  });
}

/**
 * Stops the activated scene's own linked playlist, if it has one, and keeps
 * re-checking for a few seconds afterward — a single immediate stopAll()
 * isn't reliably enough on its own, since Foundry's native auto-play can
 * kick in noticeably after the updateScene hook fires (observed as "audio
 * comes in slightly delayed" in testing) rather than in the same tick.
 */
function armPlaylistSilencing(scene) {
  try {
    const ref = scene.playlist;
    const playlist = typeof ref === "string" ? game.playlists.get(ref) : ref;
    if (!playlist) return;

    pausedPlaylistId = playlist.id;
    stopIfStillArmed(playlist);

    [250, 750, 1500, 3000].forEach((delay) => {
      setTimeout(() => stopIfStillArmed(playlist), delay);
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | could not silence scene playlist`, err);
  }
}

/**
 * Only stops the playlist if we're still the ones actively suppressing it
 * — checked fresh each call against both the tracked id and GMS_ACTIVE —
 * so a re-check firing after GMS already closed (or after the GM manually
 * resumed something else) doesn't stop audio it has no business touching.
 */
function stopIfStillArmed(playlist) {
  if (pausedPlaylistId !== playlist.id) return;
  if (!game.settings.get(MODULE_ID, SETTINGS.GMS_ACTIVE)) return;
  if (playlist.playing) playlist.stopAll();
}
