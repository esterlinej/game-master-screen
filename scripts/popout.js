import { MODULE_ID, SETTINGS } from "./const.js";

const POPOUT_ID = "gms-popout";

let durationTimer = null;
let rotationTimer = null;
let rotationIndex = 0;
let pendingAutoplayRetries = [];
let retryListenersAttached = false;

const FIT_MAP = {
  contain: "contain",
  cover: "cover",
  stretch: "fill",
  original: "none"
};

/**
 * Render the small, non-blocking GM preview pane. Plain positioned div,
 * not a Foundry Application — Applications tend to grab focus/behave as
 * semi-modal, which we explicitly don't want here since the GM needs full,
 * uninterrupted access to the canvas underneath.
 *
 * Starts centered on screen, and is freely draggable by its header from
 * that point on. Audio is silent by default (avoids layering GM-side audio
 * on top of whatever players are hearing in a shared room) — a GM can opt
 * in via the "GM Popout Audio" client setting, mainly useful for fully
 * remote tables where the GM has no other way to confirm audio is playing.
 *
 * onExpire — if mediaData.duration elapses before manual close, called so
 *   core.js can trigger the full nuke-close (any GM's expiring timer ends
 *   it for everyone, same as clicking the X).
 */
export function showPopout(mediaData, onClose, onExpire) {
  removePopout();

  const el = document.createElement("div");
  el.id = POPOUT_ID;
  el.classList.add(`gms-popout-${game.settings.get(MODULE_ID, SETTINGS.POPOUT_SIZE)}`);
  el.innerHTML = `
    <div class="gms-popout-header">
      <span>Game Master Screen — active</span>
      <a class="gms-popout-close" title="Close for everyone"><i class="fa-solid fa-xmark"></i></a>
    </div>
    <div class="gms-popout-body"></div>
  `;

  const body = el.querySelector(".gms-popout-body");
  body.appendChild(buildMediaElement(mediaData));

  const audioEnabled = game.settings.get(MODULE_ID, SETTINGS.POPOUT_AUDIO);
  if (audioEnabled && mediaData.audioSrc) {
    body.appendChild(buildAudioElement(mediaData));
  }

  document.body.appendChild(el);

  centerPopout(el);
  makeDraggable(el, el.querySelector(".gms-popout-header"));

  el.querySelector(".gms-popout-close").addEventListener("click", onClose);

  if (mediaData.type === "image" && mediaData.images.length > 1 && mediaData.rotateInterval) {
    rotationIndex = 0;
    rotationTimer = setInterval(() => {
      rotationIndex = (rotationIndex + 1) % mediaData.images.length;
      const img = el.querySelector("img.gms-popout-media");
      if (img) img.src = mediaData.images[rotationIndex];
    }, mediaData.rotateInterval * 1000);
  }

  const duration = Math.max(0, Number(mediaData.duration) || 0);
  if (duration > 0 && onExpire) {
    durationTimer = setTimeout(() => onExpire(), duration * 1000);
  }

  if (audioEnabled) attachAutoplayRetryListeners();
}

export function removePopout() {
  if (durationTimer) {
    clearTimeout(durationTimer);
    durationTimer = null;
  }
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
  detachAutoplayRetryListeners();
  document.getElementById(POPOUT_ID)?.remove();
}

function buildMediaElement(mediaData) {
  const fit = FIT_MAP[mediaData.fit] ?? "contain";
  const audioEnabled = game.settings.get(MODULE_ID, SETTINGS.POPOUT_AUDIO);

  if (mediaData.type === "video") {
    const video = document.createElement("video");
    video.style.objectFit = fit;
    video.src = mediaData.src;
    video.autoplay = true;
    video.loop = !!mediaData.loop;
    video.playsInline = true;

    // Same rule as the player overlay: an independent audio track always
    // forces the video's own audio off, regardless of the popout-audio
    // setting, since the separate <audio> element is the intended source.
    const hasAudioOverride = !!mediaData.audioSrc;
    video.muted = hasAudioOverride ? true : !(audioEnabled && !mediaData.muted);
    video.volume = typeof mediaData.volume === "number" ? mediaData.volume : 1;

    if (!video.muted) {
      video.play().catch(() => pendingAutoplayRetries.push(video));
    } else {
      video.play().catch(() => {}); // muted autoplay basically never fails
    }
    return video;
  }

  const img = document.createElement("img");
  img.className = "gms-popout-media";
  img.style.objectFit = fit;
  img.src = mediaData.images[0] ?? "";
  img.alt = "";
  return img;
}

/** Independent audio layer — only ever built when GM Popout Audio is on
 *  AND mediaData.audioSrc is set (see showPopout's guard above). */
function buildAudioElement(mediaData) {
  const audio = document.createElement("audio");
  audio.src = mediaData.audioSrc;
  audio.autoplay = true;
  audio.loop = !!mediaData.loop;
  audio.muted = !!mediaData.muted;
  audio.volume = typeof mediaData.volume === "number" ? mediaData.volume : 1;
  audio.style.display = "none";
  audio.play().catch(() => pendingAutoplayRetries.push(audio));
  return audio;
}

/**
 * Same Chromium quirk as the player overlay: audio-only autoplay is gated
 * more strictly than video. Unlike the overlay, the popout never captures
 * input (the GM needs full canvas access), so these listeners are purely
 * observational — no preventDefault/stopPropagation — just watching for
 * the first genuine interaction to retry blocked playback.
 */
function attachAutoplayRetryListeners() {
  if (retryListenersAttached) return;
  retryListenersAttached = true;
  window.addEventListener("click", retryPendingAutoplay);
  window.addEventListener("keydown", retryPendingAutoplay);
}

function detachAutoplayRetryListeners() {
  if (!retryListenersAttached) return;
  retryListenersAttached = false;
  window.removeEventListener("click", retryPendingAutoplay);
  window.removeEventListener("keydown", retryPendingAutoplay);
  pendingAutoplayRetries = [];
}

function retryPendingAutoplay() {
  if (!pendingAutoplayRetries.length) return;
  const stillPending = [];
  pendingAutoplayRetries.forEach((el) => {
    el.play().catch(() => stillPending.push(el));
  });
  pendingAutoplayRetries = stillPending;
}

/** Position dead-center in the viewport using left/top (not transform),
 *  so the drag math below can just add pixel deltas directly. */
function centerPopout(el) {
  const rect = el.getBoundingClientRect();
  const left = Math.max(0, (window.innerWidth - rect.width) / 2);
  const top = Math.max(0, (window.innerHeight - rect.height) / 2);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function makeDraggable(el, handle) {
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onMouseMove = (event) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    el.style.left = `${startLeft + dx}px`;
    el.style.top = `${startTop + dy}px`;
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  handle.addEventListener("mousedown", (event) => {
    // Ignore drags started on the close button itself
    if (event.target.closest(".gms-popout-close")) return;

    startX = event.clientX;
    startY = event.clientY;
    const rect = el.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    event.preventDefault();
  });
}
