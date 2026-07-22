import { MODULE_ID, debug } from "./const.js";
import { registerSettings } from "./settings.js";
import { registerSceneControls } from "./scene-controls.js";
import { registerSceneActivationTrigger } from "./scene-activation.js";
import { registerSceneConfigTab } from "./scene-config-tab.js";
import { initSocketListener, checkActiveOnReady } from "./core.js";
import { trigger, triggerPreset, close, isActive } from "./api.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);

  // Used by scene-config-tab.hbs to build flags.game-master-screen.sceneConfig.values.X
  // field names from a namePrefix + bare field name — rolled ourselves
  // rather than relying on Foundry's own built-in `concat` helper's exact
  // signature, which wasn't worth the uncertainty for two-string joins.
  Handlebars.registerHelper("gmsField", (prefix, field) => `${prefix ?? ""}${field}`);

  registerSettings();
  registerSceneControls();
  registerSceneActivationTrigger();
  registerSceneConfigTab();

  // Public scripting/macro API — see scripts/api.js for the guarding rules
  // each function follows. Usage from a macro or MATT "Run Code" action:
  //   const api = game.modules.get("game-master-screen").api;
  //   await api.triggerPreset("Ambush!");
  game.modules.get(MODULE_ID).api = { trigger, triggerPreset, close, isActive };
});

Hooks.once("ready", () => {
  debug(`ready hook fired for user ${game.user.name} (isGM: ${game.user.isGM})`);
  initSocketListener();
  checkActiveOnReady();
});
