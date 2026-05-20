import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef } from "react";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { isTauri } from "@/lib/tauri";
import {
  killTerminalSession,
  listenTerminalOutput,
  resizeTerminalSession,
  spawnTerminalSession,
  writeTerminalSession,
} from "@/lib/workspace-terminal";
import {
  MIN_TERMINAL_COLS,
  MIN_TERMINAL_ROWS,
  sanitizeTerminalOutput,
  TERMINAL_BOOTSTRAP_MS,
  WORKSPACE_XTERM_OPTIONS,
} from "@/lib/workspace-xterm";
import { cn } from "@/lib/utils";

interface TerminalTabPaneProps {
  sessionId: string;
  isActive: boolean;
  cwd?: string | null;
  /** When false, PTY spawn waits until the default cwd has been resolved. */
  cwdReady?: boolean;
  /** Stable callback — parent sets which tab is active (tab id). */
  onRequestFocus: (tabId: string) => void;
}

export function TerminalTabPane({
  sessionId,
  isActive,
  cwd,
  cwdReady = true,
  onRequestFocus,
}: TerminalTabPaneProps) {
  const { selectBottomPanel, zone } = useAppSelection();
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  /** Frozen when the PTY is first spawned; never updated when parent `cwd` changes. */
  const spawnCwdRef = useRef<string | null | undefined>(undefined);
  const wasActiveRef = useRef(false);
  const zoneRef = useRef(zone);
  zoneRef.current = zone;

  const focusPane = useCallback(() => {
    selectBottomPanel();
    onRequestFocus(sessionId);
    termRef.current?.focus();
  }, [sessionId, selectBottomPanel, onRequestFocus]);

  const focusPaneRef = useRef(focusPane);
  focusPaneRef.current = focusPane;

  useEffect(() => {
    if (!hostRef.current) return;

    const term = new Terminal(WORKSPACE_XTERM_OPTIONS);
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);

    term.onData((data) => {
      void writeTerminalSession(sessionId, data).catch(() => {
        term.writeln("\r\n\x1b[31mCould not send input to the shell.\x1b[0m");
      });
    });

    const measureSize = () => {
      if (!hostRef.current) {
        return { cols: 80, rows: 24 };
      }
      fit.fit();
      return {
        cols: Math.max(term.cols, MIN_TERMINAL_COLS),
        rows: Math.max(term.rows, MIN_TERMINAL_ROWS),
      };
    };

    const waitForLayout = async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        fit.fit();
        if (term.cols >= MIN_TERMINAL_COLS && term.rows >= MIN_TERMINAL_ROWS) {
          return {
            cols: term.cols,
            rows: term.rows,
          };
        }
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }
      return measureSize();
    };

    termRef.current = term;
    fitRef.current = fit;

    let unlistenOutput: (() => void) | undefined;
    let resizeObserver: ResizeObserver | null = null;
    let spawned = false;
    let bootstrapTimer = 0;
    let acceptingOutput = false;

    const finishBootstrap = () => {
      term.clear();
      void writeTerminalSession(sessionId, "\x1b[2J\x1b[H\x1b[3J").finally(() => {
        void writeTerminalSession(sessionId, "\r");
      });
      acceptingOutput = true;
      void resizeTerminalSession(
        sessionId,
        Math.max(term.cols, MIN_TERMINAL_COLS),
        Math.max(term.rows, MIN_TERMINAL_ROWS),
      );
      if (isActive && zoneRef.current === "bottom-panel") {
        termRef.current?.focus();
      }
    };

    const boot = async () => {
      if (isTauri() && !cwdReady) return;
      if (spawned) return;

      if (!isTauri()) {
        term.writeln(
          "\x1b[33mTerminal requires the Forge desktop app (npm run tauri:dev).\x1b[0m",
        );
        return;
      }

      try {
        const { cols, rows } = await waitForLayout();
        term.clear();

        unlistenOutput = await listenTerminalOutput((id, data) => {
          if (id !== sessionId || !acceptingOutput) return;
          const cleaned = sanitizeTerminalOutput(data);
          if (cleaned.length > 0) {
            term.write(cleaned);
          }
        });

        if (spawnCwdRef.current === undefined) {
          spawnCwdRef.current = cwd ?? null;
        }

        await spawnTerminalSession(
          sessionId,
          cols,
          rows,
          spawnCwdRef.current,
        );
        spawned = true;

        bootstrapTimer = window.setTimeout(finishBootstrap, TERMINAL_BOOTSTRAP_MS);

        resizeObserver = new ResizeObserver(() => {
          if (!spawned) return;
          const size = measureSize();
          void resizeTerminalSession(sessionId, size.cols, size.rows);
        });
        resizeObserver.observe(hostRef.current);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not start terminal.";
        term.writeln(`\x1b[31m${message}\x1b[0m`);
      }
    };

    const onFocus = () => {
      if (zoneRef.current !== "bottom-panel") {
        selectBottomPanel();
      }
    };
    term.textarea?.addEventListener("focus", onFocus);

    if (cwdReady || !isTauri()) {
      void boot();
    }

    return () => {
      window.clearTimeout(bootstrapTimer);
      term.textarea?.removeEventListener("focus", onFocus);
      resizeObserver?.disconnect();
      unlistenOutput?.();
      void killTerminalSession(sessionId);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId, selectBottomPanel, cwdReady]);

  useEffect(() => {
    if (!isActive || !termRef.current) return;
    const becameActive = !wasActiveRef.current;
    wasActiveRef.current = true;

    requestAnimationFrame(() => {
      fitRef.current?.fit();
      const term = termRef.current;
      if (!term) return;
      void resizeTerminalSession(
        sessionId,
        Math.max(term.cols, MIN_TERMINAL_COLS),
        Math.max(term.rows, MIN_TERMINAL_ROWS),
      );
      if (becameActive) {
        focusPaneRef.current();
      }
    });
  }, [isActive, sessionId]);

  useEffect(() => {
    if (!isActive) {
      wasActiveRef.current = false;
    }
  }, [isActive]);

  return (
    <div
      className={cn(
        "absolute inset-0 p-1",
        !isActive && "pointer-events-none invisible",
      )}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        focusPane();
      }}
    >
      <div
        ref={hostRef}
        className="h-full w-full [&_.xterm]:h-full [&_.xterm]:w-full"
      />
    </div>
  );
}
