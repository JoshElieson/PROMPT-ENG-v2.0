import { useState } from "react";
import { ArrowUp, AtSign, LayoutGrid, Paperclip } from "lucide-react";
import { MenuBar } from "@/components/layout/MenuBar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { keyboardShortcuts } from "@/data/mock";

const SAMPLE_PROMPT =
  "Optimize this Rust function for performance and readability. Focus on memory usage and potential bottlenecks.";

export function MainWorkspace() {
  const [input, setInput] = useState(SAMPLE_PROMPT);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <MenuBar />
        <button
          type="button"
          title="Layout"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-panel-elevated hover:text-foreground"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </header>

      <ScrollArea className="relative flex-1">
        <section className="flex flex-col items-center px-8 pt-24 pb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome to <span className="text-accent">Prompt</span>
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

        <section className="mx-auto max-w-2xl space-y-6 px-6 py-4">
          <article>
            <p className="mb-2 text-xs text-muted">
              You <span className="text-muted-foreground">2:30 AM</span>
            </p>
            <p className="rounded-xl border border-border bg-panel px-4 py-3 text-sm leading-relaxed text-foreground/90">
              {SAMPLE_PROMPT}
            </p>
          </article>
        </section>
      </ScrollArea>

      <footer className="shrink-0 border-t border-border-subtle p-4">
        <section className="mx-auto max-w-2xl rounded-xl border border-border bg-panel focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="Ask anything..."
            className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-foreground placeholder:text-muted outline-none"
          />
          <section className="flex items-center justify-between px-3 pb-3">
            <section className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <AtSign className="h-4 w-4" />
              </Button>
            </section>
            <Button size="icon" className="h-8 w-8 rounded-lg">
              <ArrowUp className="h-4 w-4" />
            </Button>
          </section>
        </section>
      </footer>
    </main>
  );
}
