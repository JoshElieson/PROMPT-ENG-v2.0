import { useCallback, useMemo, useState } from "react";
import { Check, Code2, Copy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGit } from "@/contexts/GitContext";
import { runShellSnippet } from "@/lib/run-shell-snippet";
import {
  highlightCodeHtml,
  isRunnableShellLanguage,
  languageDisplayName,
} from "@/lib/syntax-highlight";
import "@/styles/code-highlight.css";

interface CodeSnippetBlockProps {
  language: string;
  code: string;
}

export function CodeSnippetBlock({ language, code }: CodeSnippetBlockProps) {
  const { repoPath } = useGit();
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const label = languageDisplayName(language);
  const canRun = isRunnableShellLanguage(language);
  const highlightedHtml = useMemo(
    () => highlightCodeHtml(code, language),
    [code, language],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [code]);

  const handleRun = useCallback(async () => {
    if (!canRun) return;
    setRunError(null);
    setRunning(true);
    try {
      await runShellSnippet(code, repoPath);
    } catch (err) {
      setRunError(
        err instanceof Error ? err.message : "Could not open terminal.",
      );
    } finally {
      setRunning(false);
    }
  }, [canRun, code, repoPath]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel-elevated/85">
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        <Code2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          title={copied ? "Copied" : "Copy code"}
          aria-label={copied ? "Copied" : "Copy code"}
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
        </Button>
        {canRun && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 rounded-full border-border bg-transparent px-3 text-xs font-medium text-foreground hover:bg-panel-elevated"
            title={
              repoPath
                ? `Run in terminal (${repoPath})`
                : "Run in terminal"
            }
            aria-label="Run in terminal"
            disabled={running}
            onClick={() => void handleRun()}
          >
            <Play className="h-3 w-3 fill-current" aria-hidden />
            {running ? "Opening…" : "Run"}
          </Button>
        )}
      </div>
      <pre className="code-snippet hljs overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed">
        <code
          className="hljs"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </pre>
      {runError && (
        <p className="border-t border-border-subtle px-3 py-2 text-xs text-red-400">
          {runError}
        </p>
      )}
    </div>
  );
}
