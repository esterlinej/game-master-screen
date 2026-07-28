import { MODULE_ID, SETTINGS, debug } from "./const.js";
import { showGameMasterScreen, closeGameMasterScreen } from "./core.js";
import { resolvePresetPayload } from "./media.js";

/**
 * Public scripting API — exposed at game.modules.get("game-master-screen").api.
 *
 * Unlike Herald's console-testing stopgap, this is meant to be a stable,
 * documented surface from day one: the motivating use case is Monk's Active
 * Tile Triggers' "Run Code" action firing GMS off an environmental trigger
 * (e.g. a door tile), not just a GM's own toolbar click. Every mutating
 * function therefore guards on game.user.isGM itself — a MATT tile trigger
 * commonly executes in the context of whichever token opened the door,
 * which may well be a player client, and world-scope settings.set() would
 * silently fail (or throw, depending on Foundry version) for a non-GM
 * caller anyway. Failing fast here with a clear console warning is more
 * debuggable for a macro author than chasing a permissions error two
 * layers down in core.js.
 *
 * isActive() is deliberately the one read-only exception — no isGM guard,
 * since a player-side macro condition ("only open this door if GMS isn't
 * already showing") is a legitimate use too.
 */

export async function trigger(mediaDataOverride = null) {
  if (!game.user.isGM) {
    console.warn(`${MODULE_ID} | api.trigger() called by a non-GM user — ignored`);
    return false;
  }
  await showGameMasterScreen(mediaDataOverride);
  return true;
}

export async function triggerPreset(nameOrId) {
  if (!game.user.isGM) {
    console.warn(`${MODULE_ID} | api.triggerPreset() called by a non-GM user — ignored`);
    return false;
  }
  if (!nameOrId) {
    console.warn(`${MODULE_ID} | api.triggerPreset() requires a preset id or name`);
    return false;
  }

  const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? [];
  const target = String(nameOrId).toLowerCase();
  const preset = presets.find((p) => p.id === nameOrId)
    ?? presets.find((p) => p.name?.toLowerCase() === target);

  if (!preset) {
    console.warn(`${MODULE_ID} | api.triggerPreset() — no preset found matching "${nameOrId}"`);
    ui.notifications?.warn(`Game Master Screen: no preset found matching "${nameOrId}"`);
    return false;
  }

  debug(`api.triggerPreset() firing preset "${preset.name}" (${preset.id})`);
  const mediaData = resolvePresetPayload(preset.values, preset.name);
  await showGameMasterScreen(mediaData);
  return true;
}

export async function close() {
  if (!game.user.isGM) {
    console.warn(`${MODULE_ID} | api.close() called by a non-GM user — ignored`);
    return false;
  }
  await closeGameMasterScreen();
  return true;
}

export function isActive() {
  return !!game.settings.get(MODULE_ID, SETTINGS.GMS_ACTIVE);
}
