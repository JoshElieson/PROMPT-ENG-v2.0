import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChats } from "@/contexts/ChatsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAutomationEngine } from "@/lib/automation-engine";
import {
  readAutomations,
  writeAutomations,
} from "@/lib/automation-storage";
import { githubTokenFromSession } from "@/lib/github-git-auth";
import type { AutomationDraft } from "@/types/automation";

function scheduleConfigEqual(
  left: AutomationDraft,
  right: AutomationDraft,
): boolean {
  return (
    left.triggerType === right.triggerType &&
    left.scheduleFrequency === right.scheduleFrequency &&
    left.scheduleTime === right.scheduleTime &&
    left.scheduleWeekday === right.scheduleWeekday &&
    left.scheduleIntervalMinutes === right.scheduleIntervalMinutes
  );
}

interface AutomationsContextValue {
  automations: AutomationDraft[];
  upsertAutomation: (automation: AutomationDraft) => void;
  deleteAutomation: (id: string) => void;
  setAutomationEnabled: (id: string, enabled: boolean) => void;
}

const AutomationsContext = createContext<AutomationsContextValue | null>(null);

export function AutomationsProvider({ children }: { children: ReactNode }) {
  const [automations, setAutomations] = useState<AutomationDraft[]>(() =>
    readAutomations(),
  );
  const { chats, activeChat } = useChats();
  const { projects } = useProjects();
  const { session } = useAuth();
  const githubToken = githubTokenFromSession(session);

  const allChats = useMemo(() => {
    if (activeChat && !chats.some((chat) => chat.id === activeChat.id)) {
      return [activeChat, ...chats];
    }
    return chats;
  }, [activeChat, chats]);

  useEffect(() => {
    writeAutomations(automations);
  }, [automations]);

  const markAutomationRun = useCallback((id: string, timestamp: number) => {
    setAutomations((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, lastRunAt: timestamp } : item,
      ),
    );
  }, []);

  useAutomationEngine({
    automations,
    chats: allChats,
    projects,
    githubToken,
    onAutomationRun: markAutomationRun,
  });

  const upsertAutomation = useCallback((automation: AutomationDraft) => {
    setAutomations((prev) => {
      const index = prev.findIndex((item) => item.id === automation.id);
      const existing = index === -1 ? null : prev[index];
      const nextAutomation = {
        ...automation,
        lastRunAt:
          existing && scheduleConfigEqual(existing, automation)
            ? existing.lastRunAt
            : undefined,
      };
      if (index === -1) return [...prev, nextAutomation];
      const next = [...prev];
      next[index] = nextAutomation;
      return next;
    });
  }, []);

  const deleteAutomation = useCallback((id: string) => {
    setAutomations((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const setAutomationEnabled = useCallback((id: string, enabled: boolean) => {
    setAutomations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled } : item)),
    );
  }, []);

  const value = useMemo(
    () => ({
      automations,
      upsertAutomation,
      deleteAutomation,
      setAutomationEnabled,
    }),
    [automations, upsertAutomation, deleteAutomation, setAutomationEnabled],
  );

  return (
    <AutomationsContext.Provider value={value}>
      {children}
    </AutomationsContext.Provider>
  );
}

export function useAutomations(): AutomationsContextValue {
  const context = useContext(AutomationsContext);
  if (!context) {
    throw new Error("useAutomations must be used within AutomationsProvider");
  }
  return context;
}
