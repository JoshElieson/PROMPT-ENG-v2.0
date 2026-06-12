/**
 * Shared text editing + native clipboard helpers for the global edit context
 * menu (Cut / Copy / Paste). Operations read the live DOM selection and write
 * through the native Clipboard API so behavior matches the OS exactly and stays
 * in sync with controlled inputs (the chat composer) via native input events.
 */

/** Identifies the chat input box anywhere in the app. */
const CHAT_INPUT_SELECTOR = "[data-composer-textarea]";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

/** Normalized (low → high) selection offsets for an editable element. */
export function getEditableSelection(el: EditableElement): {
  start: number;
  end: number;
} {
  const rawStart = el.selectionStart ?? 0;
  const rawEnd = el.selectionEnd ?? 0;
  return rawStart <= rawEnd
    ? { start: rawStart, end: rawEnd }
    : { start: rawEnd, end: rawStart };
}

/**
 * The editable chat input that contains `target`, or null when the target is
 * outside an editable composer (read-only / disabled composers are excluded so
 * cut & paste stay disabled there).
 */
export function findEditableChatInput(
  target: EventTarget | null,
): HTMLTextAreaElement | null {
  if (!(target instanceof Element)) return null;
  const input = target.closest<HTMLTextAreaElement>(CHAT_INPUT_SELECTOR);
  if (!input || input.readOnly || input.disabled) return null;
  return input;
}

/**
 * Currently selected text relative to `target`: the selection inside the
 * focused/right-clicked editable when present, otherwise the document
 * selection. Newlines and formatting are preserved exactly.
 */
export function readSelectedText(target: EventTarget | null): string {
  if (target instanceof Element) {
    const editable = target.closest<EditableElement>("input, textarea");
    if (editable) {
      const { start, end } = getEditableSelection(editable);
      if (end > start) return editable.value.slice(start, end);
    }
  }
  const selection = window.getSelection();
  return selection ? selection.toString() : "";
}

/** Whether the clipboard can be read (paste availability). */
export function canReadClipboard(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.readText === "function"
  );
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function setNativeValue(el: EditableElement, value: string): void {
  const prototype =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Copy the selected range to the clipboard, then remove it from the chat input.
 * Removal goes through `execCommand` (which fires a native input event so the
 * controlled composer updates and the caret lands correctly), with a manual
 * fallback for environments without command support.
 */
export async function cutChatInputSelection(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
): Promise<void> {
  if (end <= start) return;
  const text = el.value.slice(start, end);
  await copyTextToClipboard(text);

  el.focus();
  el.setSelectionRange(start, end);
  const removed = document.execCommand("delete");
  if (!removed) {
    const next = el.value.slice(0, start) + el.value.slice(end);
    setNativeValue(el, next);
    el.setSelectionRange(start, start);
  }
}

/**
 * Insert clipboard text into the chat input at the given range (replacing any
 * selection). Uses `execCommand("insertText")` so multiline text is preserved
 * and the controlled composer stays in sync, with a manual fallback.
 */
export async function pasteIntoChatInput(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
): Promise<void> {
  const text = await navigator.clipboard.readText();
  if (!text) return;

  el.focus();
  el.setSelectionRange(start, end);
  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    setNativeValue(el, next);
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
  }
}
