import { useCallback, useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canReadClipboard,
  copyTextToClipboard,
  cutChatInputSelection,
  findEditableChatInput,
  getEditableSelection,
  pasteIntoChatInput,
  readSelectedText,
} from "@/lib/edit-clipboard";

interface EditMenuState {
  x: number;
  y: number;
  /** Text selected at the moment of the right-click (preserved verbatim). */
  selectedText: string;
  /** Editable chat input under the cursor, or null when outside one. */
  chatInput: HTMLTextAreaElement | null;
  inputStart: number;
  inputEnd: number;
}

/**
 * App-wide text editing context menu (Cut / Copy / Paste).
 *
 * Copy works on any selection anywhere; Cut and Paste only act on the chat
 * input. A single document-level listener captures the selection/focus before
 * the menu steals focus and skips right-clicks already handled by a feature
 * context menu (project tree, workspace list) which call `preventDefault`.
 */
export function EditContextMenu() {
  const [menu, setMenu] = useState<EditMenuState | null>(null);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof Element && target.closest('[role="menu"]')) return;

      const selectedText = readSelectedText(target);
      const chatInput = findEditableChatInput(target);
      if (!selectedText && !chatInput) return;

      const { start, end } = chatInput
        ? getEditableSelection(chatInput)
        : { start: 0, end: 0 };

      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        selectedText,
        chatInput,
        inputStart: start,
        inputEnd: end,
      });
    };

    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  const close = useCallback(() => setMenu(null), []);

  const handleCopy = useCallback(() => {
    if (!menu) return;
    void copyTextToClipboard(menu.selectedText);
  }, [menu]);

  const handleCut = useCallback(() => {
    if (!menu?.chatInput) return;
    void cutChatInputSelection(menu.chatInput, menu.inputStart, menu.inputEnd);
  }, [menu]);

  const handlePaste = useCallback(() => {
    if (!menu?.chatInput) return;
    void pasteIntoChatInput(menu.chatInput, menu.inputStart, menu.inputEnd);
  }, [menu]);

  if (!menu) return null;

  const canCopy = menu.selectedText.length > 0;
  const canCut = menu.chatInput != null && menu.inputEnd > menu.inputStart;
  const canPaste = menu.chatInput != null && canReadClipboard();

  return (
    <DropdownMenu
      key={`${menu.x}:${menu.y}`}
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          style={{
            position: "fixed",
            left: menu.x,
            top: menu.y,
            width: 0,
            height: 0,
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={2}
        className="min-w-[180px]"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem disabled={!canCut} onSelect={handleCut}>
          Cut
          <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canCopy} onSelect={handleCopy}>
          Copy
          <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canPaste} onSelect={handlePaste}>
          Paste
          <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
