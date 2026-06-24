import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { AdvisorSuggestedAction } from "@/lib/ai/types";
import { ArrowRight, LoaderCircle, MessageSquareText, Sparkles } from "lucide-react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: AdvisorSuggestedAction[];
  warnings?: string[];
  fallbackUsed?: boolean;
};

export function ChatPanel({
  className,
  input,
  isGenerating,
  messages,
  quickReplies,
  usageSlot,
  limitSlot,
  onInputChange,
  onSend,
  onActionClick,
}: {
  className?: string;
  input: string;
  isGenerating?: boolean;
  messages: ChatMessage[];
  quickReplies: string[];
  usageSlot?: ReactNode;
  limitSlot?: ReactNode;
  onInputChange: (value: string) => void;
  onSend: (value: string) => void;
  onActionClick?: (action: AdvisorSuggestedAction) => void;
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
            <p className="text-xs text-muted-foreground">Collect needs, explain tradeoffs, and tune your build.</p>
          </div>
        </div>
        {usageSlot && <div className="mt-3">{usageSlot}</div>}
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
                {m.fallbackUsed && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mock advisor used. Build checks remain rule-based.
                  </p>
                )}
                {m.warnings && m.warnings.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {m.warnings.map((warning) => (
                      <p key={warning} className="text-xs text-warning">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.actions.map((action, index) => (
                      <button
                        key={`${m.id}-${action.type}-${index}`}
                        type="button"
                        onClick={() => onActionClick?.(action)}
                        className="rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        {getActionLabel(action)}
                      </button>
                    ))}
                  </div>
                )}
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
        {limitSlot && <div className="mb-4">{limitSlot}</div>}
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

function getActionLabel(action: AdvisorSuggestedAction) {
  if (action.label) {
    return action.label;
  }

  switch (action.type) {
    case "update_budget":
      return `Update budget to $${action.budget.toLocaleString()}`;
    case "update_use_case":
      return `Use ${action.targetUseCase.join(" + ")}`;
    case "update_appearance":
      return action.appearancePreference === "rgb"
        ? "Use RGB style"
        : `Use ${action.appearancePreference} style`;
    case "update_brand_preference":
      return `Use ${[action.cpuBrandPreference?.toUpperCase(), action.gpuBrandPreference?.toUpperCase()]
        .filter(Boolean)
        .join(" / ")} preference`;
    case "update_experience_level":
      return `Set ${action.experienceLevel} experience`;
    case "add_owned_part":
      return "Add owned part";
    case "open_part_explorer":
      return `Open ${action.category.toUpperCase()} Explorer`;
    case "explain_current_build":
      return "Explain current build";
    case "ask_clarifying_question":
      return "Ask clarifying question";
  }
}
