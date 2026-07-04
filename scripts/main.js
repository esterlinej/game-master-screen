import { MODULE_ID, debug } from "./const.js";
import { registerSettings } from "./settings.js";
import { registerSceneControls } from "./scene-controls.js";
import { initSocketListener, checkActiveOnReady } from "./core.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
  registerSettings();
  registerSceneControls();
});

Hooks.once("ready", () => {
  debug(`ready hook fired for user ${game.user.name} (isGM: ${game.user.isGM})`);
  initSocketListener();
  checkActiveOnReady();
});
