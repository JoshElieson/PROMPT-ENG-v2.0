import { RoundTableDiscussion } from "@/components/chat/RoundTableDiscussion";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import type { ResponseLoadingState } from "@/types/chat";

interface ResponseLoadingViewProps {
  loading: ResponseLoadingState;
}

export function ResponseLoadingView({ loading }: ResponseLoadingViewProps) {
  return (
    <article className="flex w-full flex-col items-start gap-2">
      <section className="w-full max-w-2xl space-y-3 py-1 pr-2">
        <RoundTableDiscussion
          modelIds={loading.targetModelIds}
          speakingModelIndex={loading.speakingModelIndex}
          phase={loading.phase}
        />
        <div className="flex items-center gap-2 border-t border-border-subtle pt-2">
          <TypingIndicator />
        </div>
      </section>
    </article>
  );
}
