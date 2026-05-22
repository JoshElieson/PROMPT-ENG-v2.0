import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLayout } from "@/contexts/LayoutContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAppToast } from "@/contexts/AppToastContext";
import {
  aiTargets,
  findAiTargetElement,
  getAiTarget,
} from "@/lib/ui-target-registry";
import type { UICommand, UIHighlightScope, UISettingsTab } from "@/types/ui-command";

type PendingSettingChange = {
  id: string;
  command: Extract<UICommand, { type: "CHANGE_SETTING" }>;
};

interface AiCommandBusValue {
  enqueueCommands: (commands: UICommand[]) => void;
}

const DEFAULT_HIGHLIGHT_MS = 8000;
const COMMAND_TARGET_RETRY_MS = 1800;

const AiCommandBusContext = createContext<AiCommandBusValue | null>(null);

function toSettingsSection(tab: UISettingsTab): string {
  if (tab === "appearance") return "appearance";
  if (tab === "models") return "models";
  if (tab === "agent") return "agents";
  if (tab === "workspace") return "workflows";
  if (tab === "files") return "plugins";
  return "general";
}

function scopeSelector(scope: UIHighlightScope): string {
  if (scope === "settings") return '[data-ai-scope="settings"]';
  if (scope === "chat") return '[data-ai-scope="chat"]';
  if (scope === "workspace") return '[data-ai-scope="workspace"]';
  return '[data-ai-scope="sidebar"]';
}

export function AiCommandBusProvider({ children }: { children: ReactNode }) {
  const { openSettings } = useLayout();
  const { applySettingChange } = useAppSettings();
  const { pushToast } = useAppToast();
  const queueRef = useRef<UICommand[]>([]);
  const [queueVersion, setQueueVersion] = useState(0);
  const [pendingSettingChange, setPendingSettingChange] =
    useState<PendingSettingChange | null>(null);
  const processingRef = useRef(false);
  const highlightTimersRef = useRef(new Map<HTMLElement, number>());
  const highlightLabelsRef = useRef(new Map<HTMLElement, HTMLDivElement>());

  const clearElementHighlight = useCallback((el: HTMLElement) => {
    el.classList.remove("ai-command-highlight");
    el.removeAttribute("data-ai-highlight-label");
    const timerId = highlightTimersRef.current.get(el);
    if (timerId) window.clearTimeout(timerId);
    highlightTimersRef.current.delete(el);
    const label = highlightLabelsRef.current.get(el);
    label?.remove();
    highlightLabelsRef.current.delete(el);
  }, []);

  const clearHighlights = useCallback(() => {
    const active = Array.from(highlightTimersRef.current.keys());
    for (const el of active) {
      clearElementHighlight(el);
    }
  }, [clearElementHighlight]);

  const applyHighlightToElement = useCallback(
    (el: HTMLElement, label?: string, durationMs?: number) => {
      clearElementHighlight(el);
      el.classList.add("ai-command-highlight");
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      if (label) {
        el.setAttribute("data-ai-highlight-label", label);
        const rect = el.getBoundingClientRect();
        const chip = document.createElement("div");
        chip.className = "ai-command-highlight-label";
        chip.textContent = label;
        chip.style.left = `${Math.max(8, rect.left)}px`;
        chip.style.top = `${Math.max(8, rect.top - 28)}px`;
        document.body.appendChild(chip);
        highlightLabelsRef.current.set(el, chip);
      }
      const timeout = window.setTimeout(
        () => clearElementHighlight(el),
        durationMs ?? DEFAULT_HIGHLIGHT_MS,
      );
      highlightTimersRef.current.set(el, timeout);
    },
    [clearElementHighlight],
  );

  const findElementByText = useCallback((text: string, scope?: UIHighlightScope) => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return null;
    const root = scope
      ? document.querySelector<HTMLElement>(scopeSelector(scope))
      : document.body;
    if (!root) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.textContent?.trim().toLowerCase();
      if (!value || !value.includes(normalized)) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      return parent.closest<HTMLElement>("[data-ai-target]") ?? parent;
    }
    return null;
  }, []);

  const waitForTarget = useCallback(async (targetId: string): Promise<HTMLElement | null> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < COMMAND_TARGET_RETRY_MS) {
      const el = findAiTargetElement(targetId);
      if (el) return el;
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    return null;
  }, []);

  const executeSafeCommand = useCallback(
    async (command: Exclude<UICommand, { type: "CHANGE_SETTING" }>) => {
      if (command.type === "OPEN_SETTINGS") {
        openSettings();
        if (command.tab) {
          const sectionId = toSettingsSection(command.tab);
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("forge:settings-navigate", { detail: { sectionId } }),
            );
          }, 0);
        }
        return;
      }
      if (command.type === "HIGHLIGHT_ELEMENT") {
        const targetMeta = getAiTarget(command.targetId);
        const el =
          (await waitForTarget(command.targetId)) ??
          (targetMeta?.label ? findElementByText(targetMeta.label) : null);
        if (!el) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn(`[forge-ui] Target not found: ${command.targetId}`);
          }
          return;
        }
        applyHighlightToElement(
          el,
          command.label ?? targetMeta?.label,
          command.durationMs,
        );
        return;
      }
      if (command.type === "HIGHLIGHT_TEXT") {
        const el = findElementByText(command.text, command.scope);
        if (!el) return;
        applyHighlightToElement(el, command.text, command.durationMs);
        return;
      }
      if (command.type === "CLEAR_HIGHLIGHTS") {
        clearHighlights();
      }
    },
    [applyHighlightToElement, clearHighlights, findElementByText, openSettings, waitForTarget],
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current || pendingSettingChange) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current.shift();
        if (!next) break;
        if (next.type === "CHANGE_SETTING") {
          setPendingSettingChange({
            id: crypto.randomUUID(),
            command: next,
          });
          break;
        }
        await executeSafeCommand(next);
      }
    } finally {
      processingRef.current = false;
    }
  }, [executeSafeCommand, pendingSettingChange]);

  const enqueueCommands = useCallback((commands: UICommand[]) => {
    if (commands.length === 0) return;
    queueRef.current.push(...commands);
    setQueueVersion((v) => v + 1);
  }, []);

  const approvePendingSettingChange = useCallback(() => {
    if (!pendingSettingChange) return;
    const result = applySettingChange({
      settingKey: pendingSettingChange.command.settingKey,
      value: pendingSettingChange.command.value,
      source: "ai",
    });
    if (result.ok) {
      pushToast("Setting updated.", "success");
    } else {
      pushToast(`Could not update setting: ${result.reason ?? "Invalid value."}`, "error");
    }
    setPendingSettingChange(null);
    setQueueVersion((v) => v + 1);
  }, [applySettingChange, pendingSettingChange, pushToast]);

  const rejectPendingSettingChange = useCallback(() => {
    if (!pendingSettingChange) return;
    pushToast("AI setting change canceled.", "info");
    setPendingSettingChange(null);
    setQueueVersion((v) => v + 1);
  }, [pendingSettingChange, pushToast]);

  useEffect(() => {
    void processQueue();
  }, [queueVersion, processQueue]);

  useEffect(() => {
    const clearOnInteraction = () => clearHighlights();
    const clearOnRouteLikeChange = () => clearHighlights();
    window.addEventListener("click", clearOnInteraction, true);
    window.addEventListener("popstate", clearOnRouteLikeChange);
    window.addEventListener("hashchange", clearOnRouteLikeChange);
    window.addEventListener("forge:settings-navigate", clearOnRouteLikeChange);
    window.addEventListener("forge:settings-section-changed", clearOnRouteLikeChange);
    return () => {
      window.removeEventListener("click", clearOnInteraction, true);
      window.removeEventListener("popstate", clearOnRouteLikeChange);
      window.removeEventListener("hashchange", clearOnRouteLikeChange);
      window.removeEventListener("forge:settings-navigate", clearOnRouteLikeChange);
      window.removeEventListener(
        "forge:settings-section-changed",
        clearOnRouteLikeChange,
      );
    };
  }, [clearHighlights]);

  const pendingSettingLabel = useMemo(() => {
    if (!pendingSettingChange) return "";
    const byTarget = Object.values(aiTargets).find(
      (meta) => meta.settingKey === pendingSettingChange.command.settingKey,
    );
    return byTarget?.label ?? pendingSettingChange.command.settingKey;
  }, [pendingSettingChange]);

  const value = useMemo(() => ({ enqueueCommands }), [enqueueCommands]);

  return (
    <AiCommandBusContext.Provider value={value}>
      {children}
      {pendingSettingChange ? (
        <section className="fixed right-4 bottom-4 z-[240] w-[26rem] max-w-[calc(100vw-2rem)] rounded-xl border border-indigo-400/35 bg-panel/95 p-3 shadow-[0_18px_34px_rgba(2,6,23,0.5)] backdrop-blur-md">
          <p className="text-sm font-medium text-foreground">AI requested a setting change</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Change <span className="text-foreground">{pendingSettingLabel}</span> to{" "}
            <span className="text-foreground">
              {JSON.stringify(pendingSettingChange.command.value)}
            </span>
            ?
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={rejectPendingSettingChange}
              className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-panel-elevated/70 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={approvePendingSettingChange}
              className="rounded-md border border-indigo-400/40 bg-indigo-500/20 px-2 py-1 text-xs text-indigo-100 transition-colors hover:bg-indigo-500/35"
            >
              Approve
            </button>
          </div>
        </section>
      ) : null}
    </AiCommandBusContext.Provider>
  );
}

export function useAiCommandBus() {
  const ctx = useContext(AiCommandBusContext);
  if (!ctx) {
    throw new Error("useAiCommandBus must be used within AiCommandBusProvider");
  }
  return ctx;
}

