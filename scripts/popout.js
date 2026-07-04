const POPOUT_ID = "gms-popout";

let durationTimer = null;
let rotationTimer = null;
let rotationIndex = 0;

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
 * that point on. No audio plays here regardless of settings — the popout
 * is a silent visual reference only, to avoid layering GM-side audio on
 * top of whatever the players are hearing.
 *
 * onExpire — if mediaData.duration elapses before manual close, called so
 *   core.js can trigger the full nuke-close (any GM's expiring timer ends
 *   it for everyone, same as clicking the X).
 */
export function showPopout(mediaData, onClose, onExpire) {
  removePopout();

  const el = document.createElement("div");
  el.id = POPOUT_ID;
  el.innerHTML = `
    <div class="gms-popout-header">
      <span>Game Master Screen — active</span>
      <a class="gms-popout-close" title="Close for everyone"><i class="fa-solid fa-xmark"></i></a>
    </div>
    <div class="gms-popout-body">
      ${buildPreviewHTML(mediaData)}
    </div>
  `;
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
  document.getElementById(POPOUT_ID)?.remove();
}

function buildPreviewHTML(mediaData) {
  const fit = FIT_MAP[mediaData.fit] ?? "contain";
  if (mediaData.type === "video") {
    const loopAttr = mediaData.loop ? "loop" : "";
    return `<video src="${mediaData.src}" autoplay muted ${loopAttr} playsinline style="object-fit:${fit}"></video>`;
  }
  const first = mediaData.images[0] ?? "";
  return `<img class="gms-popout-media" src="${first}" alt="" style="object-fit:${fit}" />`;
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
