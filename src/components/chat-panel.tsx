import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { AdvisorSuggestedAction } from "@/lib/ai/types";
import { ArrowRight, LoaderCircle, MessageSquareText, Sparkles } from "lucide-react";

const STRUCTURED_LABELS = [
  "Direct answer",
  "Recommendation",
  "Reasoning",
  "Budget impact",
  "Compatibility impact",
  "Performance tradeoff",
  "Practical recommendation",
  "Next step",
  "Fit",
  "Next action",
];

const STRUCTURED_LABEL_PATTERN = new RegExp(`^(${STRUCTURED_LABELS.join("|")}):\\s*(.*)$`, "i");

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
  failedMessage,
  onInputChange,
  onSend,
  onRetry,
  onActionClick,
}: {
  className?: string;
  input: string;
  isGenerating?: boolean;
  messages: ChatMessage[];
  quickReplies: string[];
  usageSlot?: ReactNode;
  limitSlot?: ReactNode;
  failedMessage?: string | null;
  onInputChange: (value: string) => void;
  onSend: (value: string) => void;
  onRetry?: () => void;
  onActionClick?: (action: AdvisorSuggestedAction) => void;
}) {
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const showStarterPrompts =
    messages.length === 0 || (messages.length === 1 && messages[0]?.role === "assistant");

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
        "flex h-full min-h-0 w-full flex-col overflow-hidden border-t border-border/80 bg-card/88 shadow-elevated backdrop-blur-xl lg:w-[390px] lg:border-l lg:border-t-0 xl:w-[410px]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/80 bg-surface-subtle/55 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <MessageSquareText className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI Consultation Assistant</p>
            <p className="text-xs text-muted-foreground">
              Collect needs, explain tradeoffs, and tune your build.
            </p>
          </div>
        </div>
        {usageSlot && <div className="mt-3">{usageSlot}</div>}
      </div>

      {showStarterPrompts && (
        <div className="shrink-0 border-b border-border/80 bg-background/25 px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Demo Starters
            </p>
            <span className="text-[11px] text-muted-foreground">Click one to run the flow</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => onSend(reply)}
                disabled={isGenerating}
                className="max-w-full rounded-xl border border-border/80 bg-surface-elevated/65 px-3 py-2 text-left text-xs leading-snug text-foreground transition-all hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={messagesRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {messages.map((m) =>
          m.role === "assistant" ? (
            <div key={m.id} className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
                <span className="text-xs font-bold uppercase text-primary">AI</span>
              </div>
              <div className="min-w-0 rounded-2xl rounded-tl-none border border-border/80 bg-surface-elevated/70 p-4 shadow-card">
                <StructuredAssistantMessage text={m.text} />
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
            <div className="rounded-2xl rounded-tl-none border border-border/80 bg-surface-elevated/70 p-4 text-sm text-muted-foreground shadow-card">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                Updating recommendation
              </div>
              <p className="mt-1 text-xs">
                Checking budget, fit, compatibility, and replacement options.
              </p>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend(input);
        }}
        className="shrink-0 border-t border-border/80 bg-card/95 p-5 shadow-[0_-18px_48px_-36px_rgba(0,0,0,0.9)] backdrop-blur-xl"
      >
        {limitSlot && <div className="mb-4">{limitSlot}</div>}
        {failedMessage && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <p className="font-semibold">The last advisor request did not complete.</p>
            <p className="mt-1 line-clamp-2 text-destructive/85">{failedMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              disabled={isGenerating || !onRetry}
              className="mt-2 rounded-md border border-destructive/30 bg-background px-3 py-1.5 font-medium transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Retry last request
            </button>
          </div>
        )}
        {showStarterPrompts && (
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Try a starter above or type your own budget, target resolution, look, or upgrade
            question.
          </div>
        )}
        <div className="relative">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            type="text"
            placeholder="Share budget, use case, preferred look, or brand..."
            className="w-full rounded-xl border border-input bg-surface-subtle px-5 py-4 pr-14 text-sm shadow-inner transition-all placeholder:text-muted-foreground/80 focus:border-primary/55 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
            disabled={isGenerating}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={isGenerating || input.trim().length === 0}
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow transition-all hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
          </button>
        </div>
      </form>
    </aside>
  );
}

function StructuredAssistantMessage({ text }: { text: string }) {
  const sections = parseStructuredMessage(text);

  if (!sections) {
    return <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>;
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {sections.map((section, index) => (
        <section key={`${section.label}-${index}`} className="min-w-0">
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            {section.label}
          </h3>
          <p className="whitespace-pre-line break-words text-muted-foreground">{section.body}</p>
        </section>
      ))}
    </div>
  );
}

function parseStructuredMessage(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: Array<{ label: string; body: string }> = [];

  lines.forEach((line) => {
    const match = line.match(STRUCTURED_LABEL_PATTERN);

    if (!match) {
      const previousSection = sections.at(-1);

      if (previousSection) {
        previousSection.body = `${previousSection.body}\n${line}`;
      }

      return;
    }

    sections.push({
      label: normalizeStructuredLabel(match[1]),
      body: match[2],
    });
  });

  return sections.length > 0 ? sections : null;
}

function normalizeStructuredLabel(label: string) {
  const normalized = STRUCTURED_LABELS.find(
    (structuredLabel) => structuredLabel.toLowerCase() === label.toLowerCase(),
  );

  return normalized ?? label;
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
      return `Use ${[
        action.cpuBrandPreference?.toUpperCase(),
        action.gpuBrandPreference?.toUpperCase(),
      ]
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
