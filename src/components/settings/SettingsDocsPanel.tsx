import { BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openExternal } from "@/lib/open-external";

const FORGE_DOCUMENTATION_URL =
  "https://pe-web-ebon.vercel.app/forge-documentation.html";

export function SettingsDocsPanel() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <section
        className="border-border-subtle bg-panel/60 rounded-xl border p-4"
        data-ai-target="settings.docs.full-documentation"
      >
        <div className="mb-2 flex items-center gap-2">
          <BookOpen className="text-muted-foreground h-4 w-4" />
          <p className="text-sm font-medium text-foreground">Documentation</p>
        </div>
        <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
          Browse guides, reference material, and tips for getting the most out of
          Forge.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void openExternal(FORGE_DOCUMENTATION_URL)}
        >
          View Full Documentation
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </section>
    </div>
  );
}
