import { useEffect, useRef } from "react";

import { ForgeWordmark } from "@/components/brand/ForgeWordmark";
import { ActiveModelsBar } from "@/components/chat/ActiveModelsBar";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ResponseLoadingView } from "@/components/chat/ResponseLoadingView";

import { ScrollArea } from "@/components/ui/scroll-area";

import { useChats } from "@/contexts/ChatsContext";
import { shouldShowMessageTime } from "@/lib/chat-utils";

import { keyboardShortcuts } from "@/data/mock";



export function MainWorkspace() {

  const { activeChat, responseLoading } = useChats();

  const scrollRef = useRef<HTMLDivElement>(null);



  const messages = activeChat?.messages ?? [];

  const showWelcome = messages.length === 0;



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

            <p className="mt-2 text-muted-foreground">

              One prompt. Multiple models. Better answers.

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


