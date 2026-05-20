import type { ITerminalOptions } from "@xterm/xterm";

/** Shared xterm options for integrated workspace terminals. */
export const WORKSPACE_XTERM_OPTIONS: ITerminalOptions = {
  cursorBlink: true,
  cursorStyle: "bar",
  fontSize: 13,
  fontFamily: '"Cascadia Mono", "Consolas", "Menlo", monospace',
  customGlyphs: false,
  convertEol: false,
  windowsPty: { backend: "winpty" },
  windowOptions: {
    restoreWin: false,
    minimizeWin: false,
    setWinPosition: false,
    setWinSizePixels: false,
    raiseWin: false,
    lowerWin: false,
    refreshWin: false,
    setWinSizeChars: false,
    maximizeWin: false,
    fullscreenWin: false,
    getWinState: false,
    getWinPosition: false,
    getWinSizePixels: false,
    getScreenSizePixels: false,
    getCellSizePixels: false,
    getWinSizeChars: false,
    getScreenSizeChars: false,
    getIconTitle: false,
    getWinTitle: false,
    pushTitle: false,
    popTitle: false,
    setWinLines: false,
  },
  theme: {
    background: "#1a1a1a",
    foreground: "#d4d4d4",
    cursor: "#d4d4d4",
    selectionBackground: "#3a3d41",
    black: "#1a1a1a",
    red: "#f44747",
    green: "#6a9955",
    yellow: "#dcdcaa",
    blue: "#569cd6",
    magenta: "#c586c0",
    cyan: "#4ec9b0",
    white: "#d4d4d4",
    brightBlack: "#666666",
    brightRed: "#f44747",
    brightGreen: "#6a9955",
    brightYellow: "#dcdcaa",
    brightBlue: "#569cd6",
    brightMagenta: "#c586c0",
    brightCyan: "#4ec9b0",
    brightWhite: "#ffffff",
  },
};

/** Ms to discard startup noise from the shell before showing live output. */
export const TERMINAL_BOOTSTRAP_MS = 450;

const GREATER_THAN_LINE = /^[>\s]+$/;
/** Box-drawing + PowerShell private-use prompt glyphs that render as tofu without a nerd font. */
const STARTUP_NOISE_CHARS = /[\u2580-\u259F\uE000-\uF8FF]/g;

/** Strip PowerShell/xterm startup noise (glyph line + `>>>>` rows). */
export function sanitizeTerminalOutput(data: string): string {
  const stripped = data.replace(STARTUP_NOISE_CHARS, "");
  return stripped
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (GREATER_THAN_LINE.test(trimmed) && trimmed.includes(">")) return false;
      return true;
    })
    .join("\r\n");
}

export const MIN_TERMINAL_COLS = 40;
export const MIN_TERMINAL_ROWS = 8;
