/** Longer than the dialog close transition (`duration-quick`, 150 ms) plus a frame. */
export const DIALOG_CLOSE_MS = 200;

/**
 * Runs `fn` after a dialog finished closing. Dialogs return focus to their trigger when they
 * close; moving focus (for example with `focusSection`) must happen after that.
 */
export function afterDialogClose(fn: () => void): void {
  setTimeout(fn, DIALOG_CLOSE_MS);
}
