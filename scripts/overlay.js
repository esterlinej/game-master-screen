const OVERLAY_ID = "gms-player-overlay";

let rotationTimer = null;
let rotationIndex = 0;
let keydownBlocker = null;
let originalNotify = null;
let durationTimer = null;
let fadeOutMs = 0;
let clickDismissHandler = null;
let pendingAutoplayRetries = [];
let retryClickListener = null;

const FIT_MAP = {
  contain: "contain",
  cover: "cover",
  stretch: "fill",
  original: "none"
};

/**
 * Render the full-bleed, input-locking overlay on this client.
 * Appended directly to document.body (not any Foundry UI container) so it
 * sits above all core UI without fighting Foundry's own stacking contexts.
 *
 * options.onExpire — called once if mediaData.duration elapses before the
 *   overlay is otherwise closed. What happens next (full nuke-close vs. a
 *   purely local teardown) is core.js's decision, not this module's.
 * options.preview — GM-only local preview from the Settings form: skips
 *   input lockout/notification suppression (the GM needs their own escape
 *   hatch) and closes on click instead of waiting for a socket event.
 */
export function showOverlay(mediaData, options = {}) {
  const { onExpire, preview = false } = options;
  removeOverlay(); // guard against a stray double-render

  fadeOutMs = Math.max(0, Number(mediaData.fadeOut) || 0);
  const fadeInMs = Math.max(0, Number(mediaData.fadeIn) || 0);

  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.style.opacity = fadeInMs > 0 ? "0" : "1";
  el.style.transition = fadeInMs > 0 ? `opacity ${fadeInMs}ms ease` : "";

  const mediaEl = buildMediaElement(mediaData);
  el.appendChild(mediaEl);

  if (mediaData.audioSrc) {
    el.appendChild(buildAudioElement(mediaData));
  }

  if (preview) {
    const badge = document.createElement("div");
    badge.className = "gms-preview-badge";
    badge.textContent = "Preview — click anywhere to close";
    el.appendChild(badge);

    clickDismissHandler = () => removeOverlay();
    el.addEventListener("click", clickDismissHandler);
  }

  document.body.appendChild(el);

  if (fadeInMs > 0) {
    // Force the browser to commit the initial opacity:0 state before
    // triggering the transition to opacity:1. A single requestAnimationFrame
    // isn't reliably enough on its own — the browser can coalesce both style
    // changes into one paint and skip the transition entirely, which is
    // exactly the flaky "fade-out works, fade-in doesn't" pattern this fixes.
    void el.offsetHeight; // synchronous layout flush
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = "1";
      });
    });
  }

  if (mediaData.type === "image" && mediaData.images.length > 1 && mediaData.rotateInterval) {
    rotationIndex = 0;
    rotationTimer = setInterval(() => {
      rotationIndex = (rotationIndex + 1) % mediaData.images.length;
      const img = el.querySelector("img.gms-media-primary");
      if (img) img.src = mediaData.images[rotationIndex];
    }, mediaData.rotateInterval * 1000);
  }

  const duration = Math.max(0, Number(mediaData.duration) || 0);
  if (duration > 0 && onExpire) {
    durationTimer = setTimeout(() => onExpire(), duration * 1000);
  }

  if (!preview) {
    lockInput();
  }
}

export function removeOverlay() {
  const el = document.getElementById(OVERLAY_ID);

  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
  if (durationTimer) {
    clearTimeout(durationTimer);
    durationTimer = null;
  }
  if (clickDismissHandler && el) {
    el.removeEventListener("click", clickDismissHandler);
    clickDismissHandler = null;
  }
  unlockInput();

  if (!el) return;

  if (fadeOutMs <= 0) {
    el.remove();
    return;
  }

  el.style.transition = `opacity ${fadeOutMs}ms ease`;
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  fadeOutMediaAudio(el, fadeOutMs);
  setTimeout(() => el.remove(), fadeOutMs);
}

/** Ramps audio/video volume down to 0 over durationMs, synced with the
 *  visual opacity fade — CSS transitions don't touch the volume property,
 *  so without this the sound just cuts dead the instant fade-out starts,
 *  regardless of how gentle the visual fade looks. */
function fadeOutMediaAudio(container, durationMs) {
  const mediaEls = container.querySelectorAll("audio, video");
  if (!mediaEls.length) return;

  const startVolumes = Array.from(mediaEls).map((el) => el.volume);
  const startTime = performance.now();

  function step(now) {
    const t = Math.min(1, (now - startTime) / durationMs);
    mediaEls.forEach((el, i) => {
      el.volume = startVolumes[i] * (1 - t);
    });
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function buildMediaElement(mediaData) {
  const fit = FIT_MAP[mediaData.fit] ?? "contain";

  if (mediaData.type === "video") {
    const video = document.createElement("video");
    video.className = "gms-media-primary";
    video.style.objectFit = fit;
    video.src = mediaData.src;
    video.autoplay = true;
    video.loop = !!mediaData.loop;
    video.playsInline = true;

    const hasAudioOverride = !!mediaData.audioSrc;
    const volume = typeof mediaData.volume === "number" ? mediaData.volume : 1;

    // If an independent audio track is configured, the video's own audio is
    // always forced off — the separate <audio> element is the sole source.
    // Otherwise, unmuted by default; browsers may still block autoplay
    // with sound depending on the tab's interaction history.
    video.muted = hasAudioOverride ? true : !!mediaData.muted;
    video.volume = volume;
    video.play().catch((err) => {
      console.warn("game-master-screen | video autoplay blocked, will retry on next user input", err);
      pendingAutoplayRetries.push(video);
    });
    return video;
  }

  const img = document.createElement("img");
  img.className = "gms-media-primary";
  img.style.objectFit = fit;
  img.src = mediaData.images[0] ?? "";
  img.alt = "";
  return img;
}

/** Independent audio layer — plays alongside ANY media mode, not just video. */
function buildAudioElement(mediaData) {
  const audio = document.createElement("audio");
  audio.src = mediaData.audioSrc;
  audio.autoplay = true;
  audio.loop = !!mediaData.loop;
  audio.muted = !!mediaData.muted;
  audio.volume = typeof mediaData.volume === "number" ? mediaData.volume : 1;
  audio.play().catch((err) => {
    console.warn("game-master-screen | audio autoplay blocked, will retry on next user input", err);
    pendingAutoplayRetries.push(audio);
  });
  return audio;
}

/**
 * Retries any autoplay that the browser initially blocked. A trusted
 * keydown or click still sets the browser's "user activation" flag even
 * though we suppress its normal effect immediately afterward — that flag
 * is what autoplay policy actually checks, so this is enough to unlock it.
 */
function retryPendingAutoplay() {
  if (!pendingAutoplayRetries.length) return;
  const stillPending = [];
  pendingAutoplayRetries.forEach((el) => {
    el.play().catch(() => stillPending.push(el));
  });
  pendingAutoplayRetries = stillPending;
}

/**
 * Blocks all keyboard input in the capture phase, before Foundry's own
 * hotbar/macro/escape handlers see the event, and suppresses ui.notifications
 * while active — "as if their screen is paused."
 */
function lockInput() {
  keydownBlocker = (event) => {
    event.stopImmediatePropagation();
    event.preventDefault();
    retryPendingAutoplay();
  };
  window.addEventListener("keydown", keydownBlocker, true);
  window.addEventListener("keyup", keydownBlocker, true);

  retryClickListener = () => retryPendingAutoplay();
  window.addEventListener("click", retryClickListener, true);

  if (!originalNotify) {
    originalNotify = ui.notifications.notify.bind(ui.notifications);
    ui.notifications.notify = () => {}; // swallow silently
  }
}

function unlockInput() {
  if (keydownBlocker) {
    window.removeEventListener("keydown", keydownBlocker, true);
    window.removeEventListener("keyup", keydownBlocker, true);
    keydownBlocker = null;
  }
  if (retryClickListener) {
    window.removeEventListener("click", retryClickListener, true);
    retryClickListener = null;
  }
  pendingAutoplayRetries = [];
  if (originalNotify) {
    ui.notifications.notify = originalNotify;
    originalNotify = null;
  }
}
