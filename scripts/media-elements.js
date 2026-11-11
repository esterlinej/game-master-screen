/**
 * DOM helpers for GMS overlay/popout media — release decoder buffers on
 * close/switch and preload the next image before swapping to avoid flashes.
 */

/** Drop media element references so the browser can reclaim decode buffers. */
export function releaseMediaElement(el) {
  if (!el) return;
  if (el instanceof HTMLMediaElement) {
    try {
      el.pause();
    } catch (_err) {
      /* already torn down */
    }
    el.removeAttribute("src");
    el.load();
  } else if (el instanceof HTMLImageElement) {
    el.removeAttribute("src");
  }
}

/** Release every GMS primary image/video/audio node under a container. */
export function releaseMediaInRoot(root) {
  if (!root) return;
  root.querySelectorAll("video, audio, img.gms-media-primary, img.gms-popout-media").forEach(releaseMediaElement);
}

/**
 * Assign a new image URL only after it has loaded in an off-DOM Image, so
 * list rotation does not flash empty frames. The preloader is not retained.
 */
export function swapImageWithPreload(img, nextSrc) {
  if (!img || !nextSrc) return;
  const current = img.getAttribute("src") ?? img.src ?? "";
  if (current === nextSrc) return;

  const pre = new Image();
  pre.onload = () => {
    if (img.isConnected) img.src = nextSrc;
  };
  pre.onerror = () => {
    if (img.isConnected) img.src = nextSrc;
  };
  pre.src = nextSrc;
}
