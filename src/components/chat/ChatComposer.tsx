import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import {
  ArrowUp,
  Clock,
  Loader2,
  Paperclip,
  Sparkles,
  Undo2,
} from "lucide-react";
import { AttachmentChips } from "@/components/chat/AttachmentChips";
import { ChatUtilityBar } from "@/components/chat/ChatUtilityBar";
import {
  ComposerTextarea,
  type ComposerTextareaHandle,
} from "@/components/chat/ComposerTextarea";
import { MentionAutocomplete } from "@/components/chat/MentionAutocomplete";
import { PluginInstallHint } from "@/components/chat/PluginInstallHint";
import { SupabaseConfigureHint } from "@/components/chat/SupabaseConfigureHint";
import { SlashCommandAutocomplete } from "@/components/chat/SlashCommandAutocomplete";
import { Button } from "@/components/ui/button";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useModelMode } from "@/contexts/ModelModeContext";
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
import { useChats } from "@/contexts/ChatsContext";
import { useApiUsage } from "@/contexts/ApiUsageContext";
import { resolveQueuedMessageBehavior } from "@/lib/chat-behavior";
import { useProjects } from "@/contexts/ProjectsContext";
import {
  attachmentsFromDataTransfer,
  duplicateAttachmentNamesWarning,
  filesToChatAttachments,
  mergeAttachmentsDedupeByName,
  pathsToChatAttachments,
  pickAttachmentsFromDialog,
} from "@/lib/attachments";
import {
  applyMentionSelection,
  filterCartModels,
  findResolvedMentionSpanAtCursor,
  getMentionQuery,
  insertMentionsForModels,
  isModelMentioned,
  parseMentions,
  removeMentionSpan,
  resolveTargetModelIds,
} from "@/lib/mentions";
import {
  applySlashCommandSelection,
  filterSlashCommands,
  getSlashCommandQuery,
} from "@/lib/slash-commands";
import type { SlashCommand } from "@/data/slash-commands";
import { getModelById, type AiModel } from "@/data/ai-models";
import type { ChatAttachment } from "@/types/chat";
import { resolveAgentPermissions } from "@/lib/agent-permissions";
import { optimizePromptWithAi } from "@/lib/optimize-prompt";
import { buildModelContributions } from "@/lib/round-table-weights";
import {
  dataTransferAcceptsComposerDrop,
  endProjectDrag,
  isProjectDragActive,
  readProjectDragPayload,
} from "@/lib/project-drag";
import { useAiLoadingHighlight } from "@/hooks/use-ai-loading-highlight";
import { useLayout } from "@/contexts/LayoutContext";
import { loadSupabaseConfig } from "@/plugins/supabase/supabase-auth";
import {
  isPluginInstalled,
  SUPABASE_PLUGIN_ID,
  useInstalledPlugins,
} from "@/lib/installed-plugins";
import { findUninstalledPluginMention } from "@/lib/plugin-mention-detection";
import { cn } from "@/lib/utils";

const OPTIMIZE_PROMPT_AI_TOOLTIP = "Optimize prompt wording (keep meaning)";
const UNDO_OPTIMIZE_PROMPT_TOOLTIP = "Undo optimization";

function parentDirectory(path: string): string {
  const normalized = path.replace(/[/\\]+$/, "");
  const index = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  if (index <= 0) return normalized;
  return normalized.slice(0, index);
}

interface ChatComposerProps {
  /** Sidebar chat (workspace container). */
  chatId: string;
  /** Thread within that chat (one workspace tab). */
  threadId: string;
  onSent?: () => void;
  fullWidth?: boolean;
  highlightIdsOverride?: string[];
}

export type ChatComposerHandle = {
  appendText: (text: string) => void;
  focus: () => void;
  /** Attach real file(s)/folder(s) from a drop (OS or in-app). */
  attachFromDataTransfer: (dataTransfer: DataTransfer) => boolean;
  /** Attach a project tree entry (enables AI access + adds attachment). */
  dropProjectFromDataTransfer: (dataTransfer: DataTransfer) => boolean;
};

function readSelection(
  el: HTMLTextAreaElement | null | undefined,
  fallback: number,
) {
  if (!el) return { start: fallback, end: fallback };
  return { start: el.selectionStart, end: el.selectionEnd };
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer(
    {
      chatId,
      threadId,
      onSent,
      fullWidth = false,
      highlightIdsOverride,
    },
    ref,
  ) {
  const { sendMessage, activeChat, chats, responseLoading, getQueuedMessageCount } =
    useChats();
  const {
    isAtTokenLimit,
    tokenLimitMessage,
    signInRequiredMessage,
    isSignedIn,
  } = useApiUsage();
  const { selectWorkspaceScreen } = useAppSelection();
  const { projects, setDirectoryPermissions } = useProjects();
  const {
    autoEnabled,
    setAutoEnabled,
    setLastAutoPickedIds,
  } = useModelMode();
  const { selectedIds, activeIds, roundTableModels } = useChatRoundTable();

  const mentionableIds = useMemo(
    () => selectedIds.filter((id) => activeIds.includes(id)),
    [selectedIds, activeIds],
  );

  useEffect(() => {
    if (activeIds.length === 0 && !autoEnabled) {
      setAutoEnabled(true);
    }
  }, [chatId, threadId, activeIds.length, autoEnabled, setAutoEnabled]);

  const composerChat = useMemo(
    () =>
      activeChat?.id === chatId
        ? activeChat
        : (chats.find((c) => c.id === chatId) ?? null),
    [activeChat, chats, chatId],
  );

  const composerThread = useMemo(
    () => composerChat?.threads.find((t) => t.id === threadId) ?? null,
    [composerChat, threadId],
  );

  const aiWorkspace = useMemo(() => {
    const agentPermissions = resolveAgentPermissions(composerThread);
    const gitRepoPath =
      composerChat?.gitProjectId != null
        ? projects.find((project) => project.id === composerChat.gitProjectId)
            ?.rootPath
        : undefined;
    const allowGit = agentPermissions.git && !!gitRepoPath;
    const fileAccessAllowed =
      agentPermissions.fileRead && composerChat?.fileAccessEnabled !== false;
    const enabledPaths = fileAccessAllowed
      ? Object.entries(composerChat?.permissions ?? {})
          .filter(([, p]) => p.enabled)
          .map(([path]) => path)
      : [];
    const allowTerminalPane = agentPermissions.terminal;
    const allowBrowserPane = agentPermissions.browser;
    if (
      enabledPaths.length === 0 &&
      !allowGit &&
      !allowTerminalPane &&
      !allowBrowserPane
    ) {
      return undefined;
    }
    return {
      enabledPaths,
      allowWrite: agentPermissions.fileWrite,
      allowGit,
      gitRepoPath,
      allowTerminalPane,
      allowBrowserPane,
    };
  }, [composerChat, composerThread, projects]);

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(
    null,
  );
  const [mentionIndex, setMentionIndex] = useState(0);
  const [slashIndex, setSlashIndex] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const textareaRef = useRef<ComposerTextareaHandle>(null);
  const [isComposerDragOver, setIsComposerDragOver] = useState(false);
  const [optimizingPrompt, setOptimizingPrompt] = useState(false);
  const optimizeHighlight = useAiLoadingHighlight(optimizingPrompt);
  const [promptUndoSnapshot, setPromptUndoSnapshot] = useState<string | null>(
    null,
  );
  const optimizeAbortRef = useRef(false);
  const isProgrammaticInputRef = useRef(false);

  const { openSettings } = useLayout();
  const installedPlugins = useInstalledPlugins();
  const supabasePluginInstalled = installedPlugins.has(SUPABASE_PLUGIN_ID);
  const [supabaseConnected, setSupabaseConnected] = useState(true);

  useEffect(() => {
    if (!supabasePluginInstalled) {
      setSupabaseConnected(false);
      return;
    }
    void loadSupabaseConfig().then((config) => {
      const isConnected = !!(config.personalAccessToken && config.projectUrl && config.anonKey);
      setSupabaseConnected(isConnected);
    });
  }, [chatId, threadId, supabasePluginInstalled]);

  const showDatabaseHint = useMemo(() => {
    if (!supabasePluginInstalled || supabaseConnected) return false;
    const keywords = ["database", "supabase", "postgres", "sql", "table", "schema"];
    const text = input.toLowerCase();
    return keywords.some((k) => text.includes(k));
  }, [input, supabaseConnected, supabasePluginInstalled]);

  const suggestedUninstalledPlugin = useMemo(
    () => findUninstalledPluginMention(input, installedPlugins),
    [input, installedPlugins],
  );

  const navigateToSupabase = useCallback(() => {
    if (!isPluginInstalled(SUPABASE_PLUGIN_ID)) return;
    openSettings();
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("forge:settings-navigate", {
          detail: { sectionId: "supabase" },
        })
      );
    }, 100);
  }, [openSettings]);

  const appendText = useCallback((text: string) => {
    const el = textareaRef.current?.getElement();
    let cursor = 0;
    setInput((prev) => {
      const start = el?.selectionStart ?? prev.length;
      const end = el?.selectionEnd ?? prev.length;
      const next = prev.slice(0, start) + text + prev.slice(end);
      cursor = start + text.length;
      return next;
    });
    setSelection({ start: cursor, end: cursor });
    setMentionDismissed(false);
    setSlashDismissed(false);
    setError(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  }, []);

  const focusComposer = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  const addAttachments = useCallback((incoming: ChatAttachment[]) => {
    if (incoming.length === 0) return;
    setError(null);
    setAttachmentWarning(null);
    let skipped: string[] = [];
    setAttachments((prev) => {
      const r = mergeAttachmentsDedupeByName(prev, incoming);
      skipped = r.skippedDuplicateNames;
      return r.next;
    });
    setAttachmentWarning(
      skipped.length > 0 ? duplicateAttachmentNamesWarning(skipped) : null,
    );
  }, []);

  const dropProjectFromDataTransfer = useCallback(
    (dataTransfer: DataTransfer) => {
      const projectPayload = readProjectDragPayload(dataTransfer);
      if (!projectPayload) return false;

      setError(null);
      void (async () => {
        try {
          if (projectPayload.isDirectory) {
            await setDirectoryPermissions(projectPayload.path, {
              enabled: true,
            });
          } else {
            const parentPath = parentDirectory(projectPayload.path);
            await setDirectoryPermissions(parentPath, { enabled: true });
          }
          addAttachments(pathsToChatAttachments([projectPayload.path]));
          selectWorkspaceScreen();
          focusComposer();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not attach project file to chat",
          );
        }
      })();
      return true;
    },
    [
      addAttachments,
      focusComposer,
      selectWorkspaceScreen,
      setDirectoryPermissions,
    ],
  );

  const attachFromDataTransfer = useCallback(
    (dataTransfer: DataTransfer) => {
      try {
        const incoming = attachmentsFromDataTransfer(dataTransfer);
        if (incoming.length === 0) return false;
        addAttachments(incoming);
        focusComposer();
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not attach files",
        );
        return false;
      }
    },
    [addAttachments, focusComposer],
  );

  useImperativeHandle(
    ref,
    () => ({
      appendText,
      focus: focusComposer,
      attachFromDataTransfer,
      dropProjectFromDataTransfer,
    }),
    [
      appendText,
      attachFromDataTransfer,
      dropProjectFromDataTransfer,
      focusComposer,
    ],
  );

  const cartModels = useMemo(
    () =>
      mentionableIds
        .map((id) => getModelById(id))
        .filter((m): m is AiModel => m != null),
    [mentionableIds],
  );

  const slashState = getSlashCommandQuery(input, selection.start);
  const filteredSlashCommands = slashState
    ? filterSlashCommands(slashState.query)
    : [];
  const showSlashMenu =
    !slashDismissed && slashState != null && filteredSlashCommands.length > 0;

  const mentionState =
    showSlashMenu ? null : getMentionQuery(input, selection.start, mentionableIds);
  const filteredModels = mentionState
    ? filterCartModels(mentionState.query, mentionableIds)
    : [];
  const showMentionMenu =
    !mentionDismissed && mentionState != null && filteredModels.length > 0;

  const isResponding =
    responseLoading?.chatId === chatId &&
    responseLoading.threadId === threadId;
  const queuedMessageBehavior = resolveQueuedMessageBehavior(composerChat);
  const blockSendWhileResponding =
    isResponding && queuedMessageBehavior === "block-until-responds";
  const queuedCount = getQueuedMessageCount(chatId, threadId);
  const hasComposerContent =
    input.trim().length > 0 || attachments.length > 0;
  const canSend = hasComposerContent && !blockSendWhileResponding;
  const syncSelection = useCallback((el: HTMLTextAreaElement | null) => {
    setSelection(readSelection(el, input.length));
  }, [input.length]);

  const applySelectionToTextarea = useCallback((start: number, end: number) => {
    setSelection({ start, end });
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start, end);
    });
  }, []);

  const applyOptimizedPrompt = useCallback((text: string) => {
    isProgrammaticInputRef.current = true;
    setInput(text);
    setSelection({ start: text.length, end: text.length });
    setMentionDismissed(false);
    setSlashDismissed(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(text.length, text.length);
    });
  }, []);

  const handleUndoOptimizePrompt = useCallback(() => {
    if (promptUndoSnapshot === null) return;
    applyOptimizedPrompt(promptUndoSnapshot);
    setPromptUndoSnapshot(null);
  }, [promptUndoSnapshot, applyOptimizedPrompt]);

  const handleOptimizePromptWithAi = useCallback(async () => {
    const draft = input.trim();
    if (!draft) {
      setError("Enter a prompt to optimize first.");
      return;
    }
    if (!isSignedIn) {
      setError(
        signInRequiredMessage ??
          "Sign in to send messages. Your monthly token allowance is tracked per account.",
      );
      return;
    }
    if (isAtTokenLimit) {
      setError(
        tokenLimitMessage ??
          "You've reached your monthly token limit. Upgrade to Forge Premium or wait until next month.",
      );
      return;
    }
    if (optimizingPrompt) return;

    setError(null);
    setAttachmentWarning(null);
    setOptimizingPrompt(true);
    optimizeAbortRef.current = false;

    const snapshot = input;

    try {
      const optimized = await optimizePromptWithAi(draft);
      if (optimizeAbortRef.current) return;
      setPromptUndoSnapshot(snapshot);
      applyOptimizedPrompt(optimized);
    } catch (e) {
      if (!optimizeAbortRef.current) {
        setError(
          e instanceof Error ? e.message : "Could not optimize prompt",
        );
      }
    } finally {
      setOptimizingPrompt(false);
    }
  }, [
    input,
    optimizingPrompt,
    applyOptimizedPrompt,
    isSignedIn,
    isAtTokenLimit,
    tokenLimitMessage,
    signInRequiredMessage,
  ]);

  useEffect(() => {
    optimizeAbortRef.current = true;
    setPromptUndoSnapshot(null);
  }, [chatId, threadId]);

  useEffect(() => {
    const clearDragHighlight = () => setIsComposerDragOver(false);
    window.addEventListener("dragend", clearDragHighlight);
    return () => window.removeEventListener("dragend", clearDragHighlight);
  }, []);

  const handleAttach = async () => {
    setError(null);
    setAttachmentWarning(null);
    try {
      const picked = await pickAttachmentsFromDialog();
      if (picked.length === 0) return;
      addAttachments(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not attach files");
    }
  };

  const acceptsComposerDrop = useCallback(
    (dt: DataTransfer) => dataTransferAcceptsComposerDrop(dt),
    [],
  );

  const handleComposerDragOver = useCallback(
    (e: DragEvent<HTMLElement>) => {
      if (!acceptsComposerDrop(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      setIsComposerDragOver(true);
    },
    [acceptsComposerDrop],
  );

  const handleComposerDragEnter = useCallback(
    (e: DragEvent<HTMLElement>) => {
      if (!acceptsComposerDrop(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      setIsComposerDragOver(true);
    },
    [acceptsComposerDrop],
  );

  const handleComposerDragLeave = useCallback(
    (e: DragEvent<HTMLElement>) => {
      if (!acceptsComposerDrop(e.dataTransfer)) return;
      const related = e.relatedTarget as Node | null;
      if (related && e.currentTarget.contains(related)) return;
      setIsComposerDragOver(false);
    },
    [acceptsComposerDrop],
  );

  const handleComposerDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      if (!acceptsComposerDrop(e.dataTransfer)) return;

      e.preventDefault();
      e.stopPropagation();
      setIsComposerDragOver(false);

      if (dropProjectFromDataTransfer(e.dataTransfer)) {
        endProjectDrag();
        return;
      }
      endProjectDrag();

      try {
        const incoming = attachmentsFromDataTransfer(e.dataTransfer);
        if (incoming.length === 0) return;
        addAttachments(incoming);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not attach files",
        );
      }
    },
    [acceptsComposerDrop, addAttachments, dropProjectFromDataTransfer],
  );

  const handleComposerPaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const dt = e.clipboardData;
      if (!dt) return;

      let files = Array.from(dt.files);
      if (files.length === 0 && dt.items?.length) {
        const fromItems: File[] = [];
        for (let i = 0; i < dt.items.length; i += 1) {
          const item = dt.items[i];
          if (item.kind === "file") {
            const f = item.getAsFile();
            if (f) fromItems.push(f);
          }
        }
        files = fromItems;
      }

      if (files.length === 0) return;

      e.preventDefault();
      try {
        addAttachments(filesToChatAttachments(files));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not attach files",
        );
      }
    },
    [addAttachments],
  );

  const insertModelsAtCursor = useCallback(
    (models: AiModel[]) => {
      if (models.length === 0) return false;

      setError(null);
      setMentionDismissed(true);
      const el = textareaRef.current?.getElement();
      const { start, end } = readSelection(el, input.length);
      const result = insertMentionsForModels(
        input,
        models,
        start,
        end,
        mentionableIds,
      );
      if (!result) return false;

      setInput(result.value);
      applySelectionToTextarea(result.cursor, result.cursor);
      return true;
    },
    [input, applySelectionToTextarea, mentionableIds],
  );

  const insertModelMentionAtCursor = useCallback(
    (model: AiModel) => {
      if (isModelMentioned(input, model.id, selectedIds)) return;
      insertModelsAtCursor([model]);
    },
    [input, insertModelsAtCursor, selectedIds],
  );

  const insertAllCartMentions = useCallback(() => {
    if (cartModels.length === 0) {
      setError(
        selectedIds.length === 0
          ? "Add models to your Model Cart first"
          : "Turn on at least one model in the Round Table to mention it.",
      );
      return;
    }
    insertModelsAtCursor(cartModels);
  }, [cartModels, insertModelsAtCursor, selectedIds.length]);

  const handleModelNumberShortcut = useCallback(
    (digit: number) => {
      if (digit === 4) {
        insertAllCartMentions();
        return;
      }
      const model = cartModels[digit - 1];
      if (!model) {
        setError(
          selectedIds.length === 0
            ? "Add models to your Model Cart first"
            : "Turn on a model in the Round Table to use Ctrl+1–3.",
        );
        return;
      }
      insertModelMentionAtCursor(model);
    },
    [cartModels, insertAllCartMentions, insertModelMentionAtCursor, selectedIds.length],
  );

  const selectSlashCommand = useCallback(
    (command: SlashCommand) => {
      const el = textareaRef.current?.getElement();
      const { start, end } = readSelection(el, selection.start);
      const activeSlash = getSlashCommandQuery(input, start);
      if (!activeSlash) return;

      const { value, cursor: nextCursor } = applySlashCommandSelection(
        input,
        activeSlash.start,
        end,
        command,
      );

      setInput(value);
      setSlashIndex(0);
      setSlashDismissed(true);
      setSelection({ start: nextCursor, end: nextCursor });

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [input, selection.start],
  );

  const selectMention = useCallback(
    (model: AiModel) => {
      const el = textareaRef.current?.getElement();
      const { start, end } = readSelection(el, selection.start);
      const activeMention = getMentionQuery(input, start, mentionableIds);
      if (!activeMention) return;

      if (isModelMentioned(input, model.id, selectedIds)) {
        const before = input.slice(0, activeMention.start);
        const after = input.slice(end);
        const next = `${before}${after}`;
        const cursor = activeMention.start;
        setInput(next);
        setMentionIndex(0);
        setMentionDismissed(true);
        setSelection({ start: cursor, end: cursor });
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          textareaRef.current?.setSelectionRange(cursor, cursor);
        });
        return;
      }

      const { value, cursor: nextCursor } = applyMentionSelection(
        input,
        activeMention.start,
        end,
        model.id,
      );

      setInput(value);
      setMentionIndex(0);
      setMentionDismissed(true);
      setSelection({ start: nextCursor, end: nextCursor });

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [input, selection.start, mentionableIds, selectedIds],
  );

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;

    if (!isSignedIn) {
      setError(
        signInRequiredMessage ??
          "Sign in to send messages. Your monthly token allowance is tracked per account.",
      );
      return;
    }

    if (isAtTokenLimit) {
      setError(
        tokenLimitMessage ??
          "You've reached your monthly token limit. Upgrade to Forge Premium or wait until next month.",
      );
      return;
    }

    const chatGoal = composerChat?.title;

    const hasMentions = parseMentions(trimmed, selectedIds).length > 0;
    const isAutoMode = activeIds.length === 0;

    if (autoEnabled !== isAutoMode) {
      setAutoEnabled(isAutoMode);
    }

    if (isAutoMode) {
      setLastAutoPickedIds([]);
    }

    let targets = resolveTargetModelIds(trimmed, selectedIds, activeIds, {
      autoEnabled: isAutoMode,
      goal: chatGoal,
      hasWorkspace: (aiWorkspace?.enabledPaths.length ?? 0) > 0,
    });

    const multiModelEnabled = composerChat?.multiModelMode !== false;
    if (!multiModelEnabled && targets.length > 1) {
      targets = [targets[0]];
    }

    if (isAutoMode) {
      setLastAutoPickedIds(targets);
    }

    if (hasMentions && targets.length === 0) {
      setError(
        isAutoMode
          ? "Add mentioned models to your Model Cart, or remove their @ mentions."
          : "Turn on mentioned models in the Round Table, or remove their @ mentions.",
      );
      return;
    }

    if (targets.length === 0) {
      if (isAutoMode) {
        setError(
          "No supported models are available. Configure GPT, Claude, Gemini, DeepSeek, or Grok.",
        );
      } else if (selectedIds.length === 0) {
        setError("Add at least one model to your Model Cart to send a message.");
      } else if (activeIds.length === 0) {
        setError("Turn on at least one agent in the Round Table to send a message.");
      } else {
        setError("No agents are available to respond. Check your Model Cart and Round Table.");
      }
      return;
    }

    setError(null);

    const weights = Object.fromEntries(
      roundTableModels.map((model) => [model.id, model.weight]),
    );
    const modelContributions = buildModelContributions(targets, weights);

    sendMessage({
      content: trimmed,
      attachments: attachments.length > 0 ? attachments : undefined,
      targetModelIds: targets,
      modelContributions,
      workspace: aiWorkspace,
      chatId,
      threadId,
    });
    setInput("");
    setPromptUndoSnapshot(null);
    setAttachments([]);
    setAttachmentWarning(null);
    setMentionDismissed(false);
    setSlashDismissed(false);
    setSelection({ start: 0, end: 0 });
    onSent?.();
  };

  useEffect(() => {
    const onWindowKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key !== "1" && e.key !== "2" && e.key !== "3" && e.key !== "4") {
        return;
      }
      const digit = Number(e.key);

      const target = e.target;
      if (
        target instanceof HTMLElement &&
        !target.closest("[data-composer-textarea]") &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      e.preventDefault();
      textareaRef.current?.focus();
      handleModelNumberShortcut(digit);
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [handleModelNumberShortcut]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      (e.key === "Backspace" || e.key === "Delete") &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      const el = e.currentTarget;
      const { start, end: selEnd } = readSelection(el, selection.start);
      if (start === selEnd) {
        const direction = e.key === "Backspace" ? "backspace" : "delete";
        const span = findResolvedMentionSpanAtCursor(
          input,
          start,
          selectedIds,
          direction,
        );
        if (span) {
          e.preventDefault();
          const { value: next, cursor } = removeMentionSpan(input, span);
          setInput(next);
          applySelectionToTextarea(cursor, cursor);
          return;
        }
      }
    }

    if (showSlashMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex(
          (i) => (i - 1 + filteredSlashCommands.length) % filteredSlashCommands.length,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectSlashCommand(filteredSlashCommands[slashIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashDismissed(true);
        return;
      }
    }

    if (showMentionMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + filteredModels.length) % filteredModels.length,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredModels.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filteredModels[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionDismissed(true);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) handleSend();
    }
  };

  const handleInputChange = (
    e: SyntheticEvent<HTMLTextAreaElement> & { currentTarget: HTMLTextAreaElement },
  ) => {
    const value = e.currentTarget.value;
    const { selectionStart, selectionEnd } = e.currentTarget;

    setInput(value);
    setSelection({ start: selectionStart, end: selectionEnd });
    if (!isProgrammaticInputRef.current) {
      setPromptUndoSnapshot(null);
    }
    isProgrammaticInputRef.current = false;
    setMentionIndex(0);
    setSlashIndex(0);
    setError(null);

    if (getSlashCommandQuery(value, selectionStart)) {
      setSlashDismissed(false);
    } else if (getMentionQuery(value, selectionStart, mentionableIds)) {
      setMentionDismissed(false);
    }
  };

  return (
    <footer className="shrink-0 px-3 pt-2 pb-3" data-ai-scope="chat">
      <section
        className={cn(
          "relative mx-auto flex items-stretch gap-1.5 overflow-visible",
          fullWidth ? "max-w-none" : "max-w-2xl",
        )}
      >
        <ChatUtilityBar
          chatId={chatId}
          threadId={threadId}
          highlightIds={highlightIdsOverride}
        />
        <section className="relative min-w-0 flex-1">
        {showSlashMenu && (
          <section className="absolute right-0 bottom-full left-0 z-20 mb-2 px-1">
            <SlashCommandAutocomplete
              commands={filteredSlashCommands}
              activeIndex={slashIndex}
              onSelect={selectSlashCommand}
              onActiveIndexChange={setSlashIndex}
            />
          </section>
        )}

        {showMentionMenu && (
          <section className="absolute right-0 bottom-full left-0 z-20 mb-2 px-1">
            <MentionAutocomplete
              models={filteredModels}
              activeIndex={mentionIndex}
              onSelect={selectMention}
              onActiveIndexChange={setMentionIndex}
            />
          </section>
        )}

        <section
          className={cn(
            "relative rounded-2xl border border-border bg-composer/95 shadow-soft transition-all duration-150",
            "focus-within:border-[#6366f1]/35 focus-within:ring-1 focus-within:ring-[#6366f1]/28",
            isComposerDragOver &&
              "border-[#6366f1]/55 bg-[#6366f1]/8 ring-1 ring-[#6366f1]/35",
            optimizeHighlight.visible && "ai-loading-rainbow",
            optimizeHighlight.exiting && "ai-loading-rainbow--exiting",
          )}
          onDragEnter={handleComposerDragEnter}
          onDragLeave={handleComposerDragLeave}
          onDragOver={handleComposerDragOver}
          onDrop={handleComposerDrop}
        >
          {showDatabaseHint || suggestedUninstalledPlugin ? (
            <div className="absolute bottom-full left-0 z-20 mb-2 flex flex-col gap-1.5">
              {showDatabaseHint ? (
                <SupabaseConfigureHint onClick={navigateToSupabase} />
              ) : null}
              {suggestedUninstalledPlugin ? (
                <PluginInstallHint plugin={suggestedUninstalledPlugin} />
              ) : null}
            </div>
          ) : null}

          {isComposerDragOver && (
            <div
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border border-dashed border-[#6366f1]/60 bg-[#6366f1]/8"
              aria-hidden
            >
              <span className="bg-composer/95 rounded-md px-3 py-1.5 text-sm font-medium text-accent-soft shadow-sm">
                {isProjectDragActive() ? "Drop here" : "Drop files here"}
              </span>
            </div>
          )}

          {queuedCount > 0 && (
            <section
              className="border-border-subtle flex items-center gap-2 border-b bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90"
              aria-live="polite"
            >
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="min-w-0 flex-1">
                <span className="text-foreground/90 font-medium">
                  {queuedCount === 1
                    ? "1 message queued"
                    : `${queuedCount} messages queued`}
                </span>
                <span className="text-muted">
                  {" "}
                  — sends after the agent finishes
                </span>
              </span>
            </section>
          )}

          <AttachmentChips
            attachments={attachments}
            onRemove={(id) => {
              setAttachmentWarning(null);
              setAttachments((prev) => prev.filter((f) => f.id !== id));
            }}
          />

          <div className="relative">
            <div
              className={cn("pr-9", promptUndoSnapshot !== null && "pr-16")}
            >
              <ComposerTextarea
                ref={textareaRef}
                value={input}
                cartIds={mentionableIds}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onKeyUp={(e) => syncSelection(e.currentTarget)}
                onSelect={(e) => syncSelection(e.currentTarget)}
                onClick={(e) => syncSelection(e.currentTarget)}
                onFocus={() => selectWorkspaceScreen()}
                onPaste={handleComposerPaste}
                onDragEnter={handleComposerDragEnter}
                onDragLeave={handleComposerDragLeave}
                onDragOver={handleComposerDragOver}
                onDrop={handleComposerDrop}
                minRows={1}
                placeholder="Plan, Build, / for commands, @ for context"
              />
            </div>
            <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5">
              {promptUndoSnapshot !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:bg-panel-elevated hover:text-foreground h-6 w-6 rounded-md"
                  title={UNDO_OPTIMIZE_PROMPT_TOOLTIP}
                  disabled={optimizingPrompt}
                  onClick={handleUndoOptimizePrompt}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-panel-elevated hover:text-foreground h-6 w-6 rounded-md"
                title={OPTIMIZE_PROMPT_AI_TOOLTIP}
                disabled={optimizingPrompt || input.trim().length === 0}
                onClick={() => void handleOptimizePromptWithAi()}
              >
                {optimizingPrompt ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {error && (
            <p className="px-4 pb-2 text-xs text-red-400">{error}</p>
          )}
          {!error && isAtTokenLimit && tokenLimitMessage ? (
            <p className="text-amber-500 dark:text-amber-400 px-4 pb-2 text-xs leading-relaxed">
              {tokenLimitMessage}
            </p>
          ) : null}
          {!error && !isSignedIn && signInRequiredMessage ? (
            <p className="text-muted-foreground px-4 pb-2 text-xs leading-relaxed">
              {signInRequiredMessage}
            </p>
          ) : null}
          {attachmentWarning && (
            <p className="px-4 pb-2 text-xs text-amber-500 dark:text-amber-400">
              {attachmentWarning}
            </p>
          )}

          <section className="flex items-center justify-between px-2.5 pb-2">
            <section className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Attach files"
                className="text-muted-foreground hover:bg-panel-elevated/90 hover:text-foreground h-7 w-7 rounded-md"
                onClick={() => void handleAttach()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </section>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                className="border-accent-brand bg-accent-brand text-on-accent shadow-accent-button h-7 w-7 rounded-full border hover:bg-accent-brand-hover"
                disabled={!canSend}
                onClick={handleSend}
                title={
                  blockSendWhileResponding
                    ? "Sending is disabled until the agent finishes the current reply"
                    : isResponding && hasComposerContent
                      ? "Queue message for after the agent finishes"
                      : "Send message"
                }
                aria-label={
                  blockSendWhileResponding
                    ? "Sending disabled while agent responds"
                    : isResponding && hasComposerContent
                      ? "Queue message"
                      : "Send message"
                }
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </section>
        </section>
        </section>
      </section>
    </footer>
  );
});

ChatComposer.displayName = "ChatComposer";
