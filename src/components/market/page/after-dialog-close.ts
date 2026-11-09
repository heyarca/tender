/** Give up waiting after this long and run anyway. */
export const DIALOG_CLOSE_TIMEOUT_MS = 1500;

/** Base UI marks `<html>` with this attribute while a modal dialog locks page scroll. */
const SCROLL_LOCK_ATTRIBUTE = "data-base-ui-scroll-locked";

/**
 * Runs `fn` once a modal dialog has finished closing. Base UI keeps page scroll locked until
 * the close transition ends, then restores the scroll position and returns focus to the
 * trigger, which would undo a scroll or focus move (`focusSection`) made any earlier.
 */
export function afterDialogClose(fn: () => void): void {
  if (typeof window === "undefined") return;
  const start = performance.now();
  // Wait one frame first: the dialog starts closing after the current event.
  const tick = () => {
    const locked = document.documentElement.hasAttribute(SCROLL_LOCK_ATTRIBUTE);
    if (locked && performance.now() - start < DIALOG_CLOSE_TIMEOUT_MS) {
      window.requestAnimationFrame(tick);
      return;
    }
    // Focus returns to the trigger in the same task as the unlock; move it after that.
    window.requestAnimationFrame(() => fn());
  };
  window.requestAnimationFrame(tick);
}
