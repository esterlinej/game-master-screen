import { MODULE_ID, SETTINGS, debug } from "./const.js";
import { buildMediaPayload } from "./media.js";
import { broadcastShow, broadcastClose, registerSocketListener } from "./sockets.js";
import { showOverlay, removeOverlay } from "./overlay.js";
import { showPopout, removePopout } from "./popout.js";

let triggering = false;

/**
 * GM-initiated trigger. No-ops if GMS is already active anywhere, per the
 * "ignore duplicate clicks" requirement — a single world-scope flag is the
 * source of truth so a second GM client (or a fat-fingered double click)
 * can't spawn a second overlay/broadcast.
 *
 * The `triggering` in-memory flag closes a narrow race the world-setting
 * guard alone can't: game.settings.set() is a network round-trip, so two
 * near-simultaneous calls (e.g. rapid scene activations) could both read
 * "not active yet" before either write resolves. Setting `triggering`
 * synchronously, before any await, closes that window immediately.
 *
 * `mediaDataOverride`, when provided, is used as-is instead of resolving
 * the current global-default settings — this is what lets the Presets
 * toolbar tool fire a preset's config directly as a one-off, ephemeral
 * override. It still goes through the normal broadcast/persist-for-late-
 * join/render path below, since players still need to actually see it;
 * the only thing skipped is reading (and thus depending on) the world's
 * persisted media-mode settings.
 */
export async function showGameMasterScreen(mediaDataOverride = null) {
  if (triggering || game.settings.get(MODULE_ID, SETTINGS.GMS_ACTIVE)) {
    ui.notifications.info("Game Master Screen is already active.");
    return;
  }
  triggering = true;

  try {
    const mediaData = mediaDataOverride ?? await buildMediaPayload();

    // Persisted alongside the flag — this is what lets a client connecting
    // mid-GMS (late join, reload, reconnect) catch itself up on `ready`
    // instead of only ever reacting to the live broadcast moment.
    await game.settings.set(MODULE_ID, SETTINGS.GMS_ACTIVE, true);
    await game.settings.set(MODULE_ID, SETTINGS.GMS_ACTIVE_MEDIA, mediaData);
    broadcastShow(mediaData);

    // The emitting client doesn't receive its own broadcast — render locally.
    renderLocalShow(mediaData);
  } finally {
    triggering = false;
  }
}

/**
 * The "nuke" close — callable from the popout's own X, the toolbar's Close
 * tool, or a duration timer expiring on a GM's client, by ANY GM account.
 * Always safe to call even if nothing is active (no-ops cleanly), which
 * matters for the crash-recovery case.
 */
export async function closeGameMasterScreen() {
  const mediaData = game.settings.get(MODULE_ID, SETTINGS.GMS_ACTIVE_MEDIA);
  await game.settings.set(MODULE_ID, SETTINGS.GMS_ACTIVE, false);
  await game.settings.set(MODULE_ID, SETTINGS.GMS_ACTIVE_MEDIA, null);
  broadcastClose();
  renderLocalClose();
  Hooks.callAll(`${MODULE_ID}.closed`, mediaData);
}

/** What THIS client renders when GMS activates — branches on GM vs player. */
function renderLocalShow(mediaData) {
  // Duration expiry: if a GM's own client is the one whose timer fires,
  // that's what ends it for everyone (matches "any GM can end it," same as
  // the popout's own close button). A player's timer expiring only ever
  // tears down their own local overlay — it never broadcasts anything.
  const onExpire = () => {
    if (game.user.isGM) {
      closeGameMasterScreen();
    } else {
      removeOverlay();
    }
  };

  if (game.user.isGM) {
    showPopout(mediaData, () => closeGameMasterScreen(), onExpire);
  } else {
    showOverlay(mediaData, { onExpire });
  }
}

function renderLocalClose() {
  removeOverlay();
  removePopout();
}

/**
 * Wire the socket listener. Called once from the `ready` hook.
 * Handles events broadcast by OTHER clients — this client's own
 * trigger/close already renders locally via the functions above.
 */
export function initSocketListener() {
  registerSocketListener({
    onShow: (mediaData) => renderLocalShow(mediaData),
    onClose: () => renderLocalClose()
  });
}

/**
 * Late-join / reload / reconnect catch-up. Called once from the `ready`
 * hook, after the socket listener is wired up. If GMS is already active
 * when this client connects, render it immediately from the persisted
 * media rather than waiting for a broadcast this client will never see
 * (the original trigger's broadcast already happened before this client
 * was connected to receive it).
 */
export function checkActiveOnReady() {
  const isActive = game.settings.get(MODULE_ID, SETTINGS.GMS_ACTIVE);
  if (!isActive) return;

  const mediaData = game.settings.get(MODULE_ID, SETTINGS.GMS_ACTIVE_MEDIA);
  if (!mediaData) {
    debug("GMS_ACTIVE is true but no persisted media found — skipping catch-up render");
    return;
  }

  debug(`catching up on load — GMS already active, rendering persisted media`);
  renderLocalShow(mediaData);
}
