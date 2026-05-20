import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useChats } from "@/contexts/ChatsContext";
import { useProjects } from "@/contexts/ProjectsContext";

/** Which major surface owns keyboard focus (mutually exclusive). */
export type AppSelectionZone = "projects" | "chat-list" | "workspace";

type FocusFn = () => void;

interface AppSelectionContextValue {
  zone: AppSelectionZone | null;
  chatListFocusId: string | null;
  projectFocusRootPath: string | null;
  isProjectsSelected: boolean;
  isChatListSelected: boolean;
  isWorkspaceScreenSelected: boolean;
  selectProject: (rootPath: string) => void;
  selectTopProject: () => void;
  selectChat: (chatId: string) => void;
  selectChatList: (chatId?: string | null) => void;
  selectWorkspaceScreen: () => void;
  moveChatListFocus: (delta: number) => void;
  focusComposer: () => void;
  focusWorkspaceScreen: () => void;
  registerFocusComposer: (fn: FocusFn) => () => void;
  registerFocusWorkspaceScreen: (fn: FocusFn) => () => void;
  registerFocusProjectTree: (fn: FocusFn) => () => void;
}

const AppSelectionContext = createContext<AppSelectionContextValue | null>(null);

export function AppSelectionProvider({ children }: { children: ReactNode }) {
  const { chats, activeChatId, selectChat: activateChat } = useChats();
  const { projects } = useProjects();
  const [zone, setZone] = useState<AppSelectionZone | null>(null);
  const [chatListFocusId, setChatListFocusId] = useState<string | null>(null);
  const [projectFocusRootPath, setProjectFocusRootPath] = useState<string | null>(
    null,
  );
  const focusComposerRef = useRef<FocusFn | null>(null);
  const focusWorkspaceScreenRef = useRef<FocusFn | null>(null);
  const focusProjectTreeRef = useRef<FocusFn | null>(null);

  const sortedChatIds = useCallback(() => {
    return [...chats]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((c) => c.id);
  }, [chats]);

  const resolveChatId = useCallback(
    (chatId?: string | null) => {
      const ids = sortedChatIds();
      if (chatId && ids.includes(chatId)) return chatId;
      if (activeChatId && ids.includes(activeChatId)) return activeChatId;
      return ids[0] ?? null;
    },
    [sortedChatIds, activeChatId],
  );

  const selectProject = useCallback(
    (rootPath: string) => {
      if (!projects.some((p) => p.rootPath === rootPath)) return;
      setZone("projects");
      setProjectFocusRootPath(rootPath);
    },
    [projects],
  );

  const selectChat = useCallback(
    (chatId: string) => {
      const ids = sortedChatIds();
      if (!ids.includes(chatId)) return;
      setZone("chat-list");
      setChatListFocusId(chatId);
      setProjectFocusRootPath(null);
      activateChat(chatId);
    },
    [sortedChatIds, activateChat],
  );

  const selectChatList = useCallback(
    (chatId?: string | null) => {
      const id = resolveChatId(chatId);
      if (!id) return;
      selectChat(id);
    },
    [resolveChatId, selectChat],
  );

  const selectWorkspaceScreen = useCallback(() => {
    setZone("workspace");
    setProjectFocusRootPath(null);
  }, []);

  const focusComposer = useCallback(() => {
    focusComposerRef.current?.();
  }, []);

  const focusWorkspaceScreen = useCallback(() => {
    focusWorkspaceScreenRef.current?.();
  }, []);

  const registerFocusComposer = useCallback((fn: FocusFn) => {
    focusComposerRef.current = fn;
    return () => {
      if (focusComposerRef.current === fn) {
        focusComposerRef.current = null;
      }
    };
  }, []);

  const registerFocusWorkspaceScreen = useCallback((fn: FocusFn) => {
    focusWorkspaceScreenRef.current = fn;
    return () => {
      if (focusWorkspaceScreenRef.current === fn) {
        focusWorkspaceScreenRef.current = null;
      }
    };
  }, []);

  const registerFocusProjectTree = useCallback((fn: FocusFn) => {
    focusProjectTreeRef.current = fn;
    return () => {
      if (focusProjectTreeRef.current === fn) {
        focusProjectTreeRef.current = null;
      }
    };
  }, []);

  const moveChatListFocus = useCallback(
    (delta: number) => {
      const ids = sortedChatIds();
      if (ids.length === 0) return;

      const current =
        zone === "chat-list" && chatListFocusId
          ? chatListFocusId
          : resolveChatId(null);
      if (!current) {
        selectChat(ids[0]!);
        return;
      }

      const index = ids.indexOf(current);
      const start = index >= 0 ? index : 0;
      const next = Math.min(ids.length - 1, Math.max(0, start + delta));
      selectChat(ids[next]!);
    },
    [sortedChatIds, zone, chatListFocusId, resolveChatId, selectChat],
  );

  const selectTopProject = useCallback(() => {
    const top = projects[0];
    if (!top) return;
    selectProject(top.rootPath);
    requestAnimationFrame(() => {
      focusProjectTreeRef.current?.();
    });
  }, [selectProject, projects]);

  const selectTopChat = useCallback(() => {
    const topChatId = sortedChatIds()[0];
    if (topChatId) selectChat(topChatId);
  }, [sortedChatIds, selectChat]);

  useEffect(() => {
    if (zone !== "chat-list" || !chatListFocusId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.isComposing) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveChatListFocus(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveChatListFocus(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        selectWorkspaceScreen();
        requestAnimationFrame(() => focusWorkspaceScreen());
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectTopProject();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    zone,
    chatListFocusId,
    moveChatListFocus,
    selectWorkspaceScreen,
    focusWorkspaceScreen,
    selectTopProject,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.isComposing) return;

      const target = e.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-workspace-split-host]")) return;
      if (target.closest("button, a, select")) return;

      if (zone === "workspace" && e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        focusComposer();
        return;
      }

      if (e.key === "ArrowLeft") {
        const inComposer = target.closest("[data-composer-textarea]");
        if (inComposer instanceof HTMLTextAreaElement) {
          e.preventDefault();
          e.stopPropagation();
          const active = document.activeElement;
          if (active instanceof HTMLElement) {
            active.blur();
          }
          selectTopProject();
          return;
        }

        if (zone === "workspace") {
          e.preventDefault();
          e.stopPropagation();
          selectTopChat();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [zone, selectTopChat, selectTopProject, focusComposer]);

  const value: AppSelectionContextValue = {
    zone,
    chatListFocusId,
    projectFocusRootPath,
    isProjectsSelected:
      zone === "projects" && projectFocusRootPath != null,
    isChatListSelected: zone === "chat-list" && chatListFocusId != null,
    isWorkspaceScreenSelected: zone === "workspace",
    selectProject,
    selectTopProject,
    selectChat,
    selectChatList,
    selectWorkspaceScreen,
    moveChatListFocus,
    focusComposer,
    focusWorkspaceScreen,
    registerFocusComposer,
    registerFocusWorkspaceScreen,
    registerFocusProjectTree,
  };

  return (
    <AppSelectionContext.Provider value={value}>
      {children}
    </AppSelectionContext.Provider>
  );
}

export function useAppSelection() {
  const ctx = useContext(AppSelectionContext);
  if (!ctx) {
    throw new Error("useAppSelection must be used within AppSelectionProvider");
  }
  return ctx;
}
