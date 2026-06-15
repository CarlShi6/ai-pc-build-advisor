import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { ArrowRight, LoaderCircle, MessageSquareText, Sparkles } from "lucide-react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export function ChatPanel({
  className,
  input,
  isGenerating,
  messages,
  quickReplies,
  onInputChange,
  onSend,
}: {
  className?: string;
  input: string;
  isGenerating?: boolean;
  messages: ChatMessage[];
  quickReplies: string[];
  onInputChange: (value: string) => void;
  onSend: (value: string) => void;
}) {
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isGenerating]);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden border-t border-border bg-background/95 backdrop-blur-sm lg:w-[390px] lg:border-l lg:border-t-0 xl:w-[410px]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 text-primary">
          <div className="flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <MessageSquareText className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI Consultation Assistant</p>
            <p className="text-xs text-muted-foreground">Collect needs, explain tradeoffs, and guide the sale.</p>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-border/80 px-5 py-4">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Quick Prompts
        </p>
        <div className="flex flex-wrap gap-2">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => onSend(reply)}
              disabled={isGenerating}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      <div ref={messagesRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {messages.map((m) =>
          m.role === "assistant" ? (
            <div key={m.id} className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
                <span className="text-xs font-bold uppercase text-primary">AI</span>
              </div>
              <div className="rounded-2xl rounded-tl-none border border-border bg-card p-4">
                <p className="text-sm leading-relaxed">{m.text}</p>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex flex-row-reverse gap-3">
              <div className="rounded-2xl rounded-tr-none bg-primary p-4 shadow-glow">
                <p className="text-sm text-primary-foreground">{m.text}</p>
              </div>
            </div>
          ),
        )}
        {isGenerating && (
          <div className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
              <span className="text-xs font-bold uppercase text-primary">AI</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-border bg-card p-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin text-primary" />
              Updating the recommendation...
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend(input);
        }}
        className="shrink-0 border-t border-border bg-card/85 p-5 backdrop-blur-sm"
      >
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          The input stays fixed while messages scroll above.
        </div>
        <div className="relative">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            type="text"
            placeholder="Share budget, use case, preferred look, or brand..."
            className="w-full rounded-xl border border-border bg-background px-5 py-4 pr-14 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            disabled={isGenerating}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={isGenerating}
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow transition-all hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          </button>
        </div>
      </form>
    </aside>
  );
}
