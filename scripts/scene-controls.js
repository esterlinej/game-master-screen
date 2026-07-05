import { showGameMasterScreen, closeGameMasterScreen } from "./core.js";
import { GMSSettingsApp } from "./settings-app.js";
import { GMSPresetsPlayApp } from "./presets-play-app.js";

/**
 * V13+ getSceneControlButtons: `controls` is an object keyed by control
 * name (not the pre-V13 array), and each tool requires `order` plus an
 * onChange/onClick — core throws if either handler is missing entirely.
 */
export function registerSceneControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    try {
      controls.gms = {
        name: "gms",
        title: "GMS.Controls.Title",
        icon: "fa-solid fa-clapperboard",
        order: Object.keys(controls).length,
        visible: game.user.isGM,
        tools: {
          trigger: {
            name: "trigger",
            title: "GMS.Controls.Trigger",
            icon: "fa-solid fa-play",
            order: 0,
            button: true,
            visible: game.user.isGM,
            onChange: () => showGameMasterScreen()
          },
          presets: {
            name: "presets",
            title: "GMS.Controls.Presets",
            icon: "fa-solid fa-list",
            order: 1,
            button: true,
            visible: game.user.isGM,
            onChange: () => new GMSPresetsPlayApp().render(true)
          },
          close: {
            name: "close",
            title: "GMS.Controls.Close",
            icon: "fa-solid fa-stop",
            order: 2,
            button: true,
            visible: game.user.isGM,
            onChange: () => closeGameMasterScreen()
          },
          settings: {
            name: "settings",
            title: "GMS.Controls.Settings",
            icon: "fa-solid fa-gear",
            order: 3,
            button: true,
            visible: game.user.isGM,
            onChange: () => new GMSSettingsApp().render(true)
          }
        }
      };
    } catch (err) {
      console.error("game-master-screen | Failed to register scene controls", err);
    }
  });
}
