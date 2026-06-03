/** Opens the webview's native find UI (same behavior as Ctrl+F). */
export function triggerNativeFind(): void {
  try {
    if (document.execCommand("find", false)) return;
  } catch {
    // execCommand may throw when unsupported
  }

  const init: KeyboardEventInit = {
    key: "f",
    code: "KeyF",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  };
  const target = document.activeElement ?? document.body;
  for (const type of ["keydown", "keypress", "keyup"] as const) {
    target.dispatchEvent(new KeyboardEvent(type, init));
  }
}
