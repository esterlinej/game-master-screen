import { MODULE_ID } from "./const.js";

/**
 * Register a presetsChanged hook for the lifetime of one ApplicationV2
 * window. Must pair with unregisterPresetsChangedHook on _onClose.
 */
export function registerPresetsChangedHook(app) {
  if (app._presetsHookId != null) return;
  app._presetsHookId = Hooks.on(`${MODULE_ID}.presetsChanged`, () => app.render(true));
}

export function unregisterPresetsChangedHook(app) {
  if (app._presetsHookId == null) return;
  Hooks.off(`${MODULE_ID}.presetsChanged`, app._presetsHookId);
  app._presetsHookId = null;
}

/**
 * Re-focus an existing ApplicationV2 instance (same static id) instead of
 * constructing a new one — avoids duplicate Hooks.on when the toolbar
 * button is clicked while a window is already open.
 */
export function renderOrFocusApp(AppClass) {
  const id = AppClass.DEFAULT_OPTIONS?.id;
  const existing = id ? foundry.applications.instances.get(id) : null;
  if (existing instanceof AppClass) {
    existing.render(true);
    return existing;
  }
  return new AppClass().render(true);
}
