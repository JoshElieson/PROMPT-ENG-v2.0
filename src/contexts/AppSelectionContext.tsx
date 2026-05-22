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
import { useChats } from "@/contexts/ChatsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { sortWorkspaces } from "@/lib/chat-utils";
import { findOwningProject } from "@/lib/project-paths";

/** Which major surface owns keyboard focus (mutually exclusive). */
export type AppSelectionZone =
  | "projects"
  | "chat-list"
  | "workspace"
  | "bottom-panel";

type FocusFn = () => void;
type WorkspaceSelectionTarget = "screen" | "agent-tabs";

interface AppSelectionContextValue {
  zone: AppSelectionZone | null;
  chatListFocusId: string | null;
  projectFocusRootPath: string | null;
  /** Specific folder/file row to reveal in the project tree (consumed after expand). */
  projectFocusPath: string | null;
  isProjectsSelected: boolean;
  isChatListSelected: boolean;
  isWorkspaceScreenSelected: boolean;
  isWorkspaceAgentTabsSelected: boolean;
  isBottomPanelSelected: boolean;
  selectProject: (rootPath: string) => void;
  /** Focus a path inside an existing project (expands ancestors in the tree). */
  selectProjectPath: (path: string) => void;
  selectTopProject: () => void;
  selectChat: (chatId: string) => void;
  selectChatList: (chatId?: string | null) => void;
  selectWorkspaceScreen: () => void;
  selectWorkspaceAgentTabs: () => void;
  selectBottomPanel: () => void;
  moveChatListFocus: (delta: number) => void;
  focusComposer: () => void;
  focusWorkspaceScreen: () => void;
  focusWorkspaceAgentTabs: () => void;
  registerFocusComposer: (fn: FocusFn) => () => void;
  registerFocusWorkspaceScreen: (fn: FocusFn) => () => void;
  registerFocusWorkspaceAgentTabs: (fn: FocusFn) => () => void;
  registerFocusProjectTree: (fn: FocusFn) => () => void;
  clearProjectFocusPath: () => void;
  selectTopChat: () => void;
}

const AppSelectionContext = createContext<AppSelectionContextValue | null>(null);

export function AppSelectionProvider({ children }: { children: ReactNode }) {
  const { chats, activeChat, activeChatId, selectChat: activateChat } = useChats();
  const { projects } = useProjects();
  const [zone, setZone] = useState<AppSelectionZone | null>(null);
  const [chatListFocusId, setChatListFocusId] = useState<string | null>(null);
  const [projectFocusRootPath, setProjectFocusRootPath] = useState<string | null>(
    null,
  );
  const [projectFocusPath, setProjectFocusPath] = useState<string | null>(null);
  const [workspaceSelectionTarget, setWorkspaceSelectionTarget] =
    useState<WorkspaceSelectionTarget>("screen");
  const focusComposerRef = useRef<FocusFn | null>(null);
  const focusWorkspaceScreenRef = useRef<FocusFn | null>(null);
  const focusWorkspaceAgentTabsRef = useRef<FocusFn | null>(null);
  const focusProjectTreeRef = useRef<FocusFn | null>(null);

  const sortedChatIds = useCallback(() => {
    const allChats =
      activeChat && !chats.some((chat) => chat.id === activeChat.id)
        ? [activeChat, ...chats]
        : chats;
    return sortWorkspaces(allChats).map((c) => c.id);
  }, [activeChat, chats]);

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
      setProjectFocusPath(null);
      requestAnimationFrame(() => {
        focusProjectTreeRef.current?.();
      });
    },
    [projects],
  );

  const selectProjectPath = useCallback(
    (path: string) => {
      const owning = findOwningProject(projects, path);
      if (!owning) return;
      setZone("projects");
      setProjectFocusRootPath(owning.rootPath);
      setProjectFocusPath(path);
      requestAnimationFrame(() => {
        focusProjectTreeRef.current?.();
      });
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
      setProjectFocusPath(null);
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
    setWorkspaceSelectionTarget("screen");
    setProjectFocusRootPath(null);
    setProjectFocusPath(null);
  }, []);

  const selectWorkspaceAgentTabs = useCallback(() => {
    setZone("workspace");
    setWorkspaceSelectionTarget("agent-tabs");
    setProjectFocusRootPath(null);
    setProjectFocusPath(null);
  }, []);

  const selectBottomPanel = useCallback(() => {
    setZone("bottom-panel");
    setWorkspaceSelectionTarget("screen");
    setProjectFocusRootPath(null);
    setProjectFocusPath(null);
    setChatListFocusId(null);
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      if (active.closest("[data-workspace-bottom-panel]")) return;
      if (active.closest("[data-projects-panel]")) return;
      active.blur();
    }
  }, []);

  const focusComposer = useCallback(() => {
    focusComposerRef.current?.();
  }, []);

  const focusWorkspaceScreen = useCallback(() => {
    focusWorkspaceScreenRef.current?.();
  }, []);

  const focusWorkspaceAgentTabs = useCallback(() => {
    focusWorkspaceAgentTabsRef.current?.();
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

  const registerFocusWorkspaceAgentTabs = useCallback((fn: FocusFn) => {
    focusWorkspaceAgentTabsRef.current = fn;
    return () => {
      if (focusWorkspaceAgentTabsRef.current === fn) {
        focusWorkspaceAgentTabsRef.current = null;
      }
    };
  }, []);

  const clearProjectFocusPath = useCallback(() => {
    setProjectFocusPath(null);
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
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    zone,
    chatListFocusId,
    moveChatListFocus,
  ]);

  const value = useMemo<AppSelectionContextValue>(
    () => ({
      zone,
      chatListFocusId,
      projectFocusRootPath,
      projectFocusPath,
      isProjectsSelected:
        zone === "projects" && projectFocusRootPath != null,
      isChatListSelected: zone === "chat-list" && chatListFocusId != null,
      isWorkspaceScreenSelected:
        zone === "workspace" && workspaceSelectionTarget === "screen",
      isWorkspaceAgentTabsSelected:
        zone === "workspace" && workspaceSelectionTarget === "agent-tabs",
      isBottomPanelSelected: zone === "bottom-panel",
      selectProject,
      selectProjectPath,
      selectTopProject,
      selectChat,
      selectChatList,
      selectWorkspaceScreen,
      selectWorkspaceAgentTabs,
      selectBottomPanel,
      moveChatListFocus,
      focusComposer,
      focusWorkspaceScreen,
      focusWorkspaceAgentTabs,
      registerFocusComposer,
      registerFocusWorkspaceScreen,
      registerFocusWorkspaceAgentTabs,
      registerFocusProjectTree,
      clearProjectFocusPath,
      selectTopChat,
    }),
    [
      zone,
      chatListFocusId,
      projectFocusRootPath,
      projectFocusPath,
      workspaceSelectionTarget,
      selectProject,
      selectProjectPath,
      selectTopProject,
      selectChat,
      selectChatList,
      selectWorkspaceScreen,
      selectWorkspaceAgentTabs,
      selectBottomPanel,
      moveChatListFocus,
      focusComposer,
      focusWorkspaceScreen,
      focusWorkspaceAgentTabs,
      registerFocusComposer,
      registerFocusWorkspaceScreen,
      registerFocusWorkspaceAgentTabs,
      registerFocusProjectTree,
      clearProjectFocusPath,
      selectTopChat,
    ],
  );

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
