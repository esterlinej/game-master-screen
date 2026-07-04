import { SOCKET_NAME, ACTIONS, debug } from "./const.js";

/**
 * Wire up the socket listener. Called once from the `ready` hook.
 * `onShow` / `onClose` are invoked for events broadcast by OTHER clients —
 * the emitting client always handles its own show/close locally and does
 * not receive its own broadcast (this is standard Foundry socket behavior).
 */
export function registerSocketListener({ onShow, onClose }) {
  debug(`socket listener registered for ${SOCKET_NAME}`);

  game.socket.on(SOCKET_NAME, (payload) => {
    debug(`socket event received: ${JSON.stringify(payload)}`);

    if (!payload?.action) return;

    // Only act on broadcasts from a validated GM user — otherwise any
    // connected client could spoof a show/close event on this channel.
    const sender = game.users.get(payload.senderId);
    if (!sender?.isGM) {
      debug(`ignored socket event — sender ${payload.senderId} is not a validated GM`);
      return;
    }

    switch (payload.action) {
      case ACTIONS.SHOW:
        onShow(payload.data);
        break;
      case ACTIONS.CLOSE:
        onClose();
        break;
    }
  });
}

export function broadcastShow(data) {
  debug(`broadcasting show — senderId=${game.user.id}`);
  try {
    game.socket.emit(SOCKET_NAME, { action: ACTIONS.SHOW, senderId: game.user.id, data });
    debug(`broadcastShow — emit call completed without throwing`);
  } catch (err) {
    console.error("game-master-screen | broadcastShow threw", err);
  }
}

export function broadcastClose() {
  debug(`broadcasting close — senderId=${game.user.id}`);
  try {
    game.socket.emit(SOCKET_NAME, { action: ACTIONS.CLOSE, senderId: game.user.id });
    debug(`broadcastClose — emit call completed without throwing`);
  } catch (err) {
    console.error("game-master-screen | broadcastClose threw", err);
  }
}
