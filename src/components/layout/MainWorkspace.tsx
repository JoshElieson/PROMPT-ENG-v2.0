import { useEffect, useMemo, useRef, useState } from "react";

import { ForgeWordmark } from "@/components/brand/ForgeWordmark";
import { ActiveModelsBar } from "@/components/chat/ActiveModelsBar";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ResponseLoadingView } from "@/components/chat/ResponseLoadingView";

import { ScrollArea } from "@/components/ui/scroll-area";

import { useRoundTable } from "@/context/RoundTableContext";
import { useChats } from "@/contexts/ChatsContext";
import { buildModelKeyboardShortcuts } from "@/data/mock";
import { shouldShowMessageTime } from "@/lib/chat-utils";
import { cn } from "@/lib/utils";

const SLOGAN_SENTENCES = [
  "One prompt.",
  "Multiple models.",
  "Better answers.",
] as const;

const SLOGAN_REVEAL_MS = 1000;

export function MainWorkspace() {

  const { activeChat, responseLoading } = useChats();
  const { selectedIds } = useRoundTable();

  const scrollRef = useRef<HTMLDivElement>(null);
  const keyboardShortcuts = useMemo(
    () => buildModelKeyboardShortcuts(selectedIds),
    [selectedIds],
  );



  const messages = activeChat?.messages ?? [];

  const showWelcome = messages.length === 0;
  const [sloganVisibleCount, setSloganVisibleCount] = useState(0);

  useEffect(() => {
    if (!showWelcome) {
      setSloganVisibleCount(0);
      return;
    }

    setSloganVisibleCount(0);
    const timers = SLOGAN_SENTENCES.map((_, index) =>
      window.setTimeout(
        () => setSloganVisibleCount(index + 1),
        SLOGAN_REVEAL_MS * (index + 1),
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [showWelcome]);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };

  useEffect(() => {
    if (responseLoading) scrollToEnd();
  }, [responseLoading]);



  return (

    <main className="flex min-w-0 flex-1 flex-col bg-background">

      <ActiveModelsBar />

      <ScrollArea className="relative flex-1">

        {showWelcome && (

          <section className="flex flex-col items-center px-8 pt-24 pb-8">

            <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">

              Welcome to <ForgeWordmark height={40} className="translate-y-px" />

            </h1>

            <p className="mt-2 w-full text-center text-muted-foreground">
              {SLOGAN_SENTENCES.map((sentence, index) => (
                <span
                  key={sentence}
                  className={cn(
                    "transition-opacity duration-500",
                    index < sloganVisibleCount ? "opacity-100" : "opacity-0",
                    index === SLOGAN_SENTENCES.length - 1 && "text-accent/90",
                  )}
                >
                  {sentence}
                  {index < SLOGAN_SENTENCES.length - 1 ? " " : ""}
                </span>
              ))}
            </p>



            <section className="mt-10 rounded-xl border border-border bg-panel/80 p-4 backdrop-blur-sm">

              <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">

                {keyboardShortcuts.map((shortcut) => (

                  <li key={shortcut.keys} className="flex items-center gap-3">

                    <kbd className="min-w-[3rem] rounded border border-border bg-surface px-2 py-0.5 text-center text-xs font-medium text-muted-foreground">

                      {shortcut.keys}

                    </kbd>

                    <span className="text-muted-foreground">{shortcut.label}</span>

                  </li>

                ))}

              </ul>

            </section>

          </section>

        )}



        {messages.length > 0 && (

          <section className="mx-auto max-w-2xl space-y-4 px-6 py-4">

            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                showTime={shouldShowMessageTime(
                  message.createdAt,
                  messages[index - 1]?.createdAt,
                )}
              />
            ))}

            {responseLoading && (
              <ResponseLoadingView loading={responseLoading} />
            )}

            <div ref={scrollRef} aria-hidden className="h-px" />

          </section>

        )}

      </ScrollArea>



      <ChatComposer onSent={scrollToEnd} />

    </main>

  );

}


