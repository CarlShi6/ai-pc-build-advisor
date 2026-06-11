import { cn } from "@/lib/utils";
import { useState } from "react";
import { ArrowRight, MessageSquareText, Sparkles } from "lucide-react";

type Msg = { role: "user" | "ai"; text: string; chips?: string[] };

const INITIAL: Msg[] = [
  {
    role: "ai",
    text: "Welcome! I'm your PC expert. Tell me about your budget and what you'll be using this machine for.",
  },
  {
    role: "user",
    text: "I need a PC for 4K video editing and some casual gaming. My budget is around $2,500 including a monitor.",
  },
  {
    role: "ai",
    text: "Great choice. For 4K editing, we should prioritize high RAM and a multi-core CPU. I've updated the build on the right with an i9 and an RTX 4080. Does that look okay?",
    chips: ["Show benchmarks", "Lower budget", "Quieter cooling"],
  },
];

export function ChatPanel({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [input, setInput] = useState("");

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: t },
      {
        role: "ai",
        text: "Noted. I'll factor that in and refine the recommended build on the right.",
      },
    ]);
    setInput("");
  };

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

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {messages.map((m, i) =>
          m.role === "ai" ? (
            <div key={i} className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
                <span className="text-xs font-bold uppercase text-primary">AI</span>
              </div>
              <div className="rounded-2xl rounded-tl-none border border-border bg-card p-4">
                <p className="text-sm leading-relaxed">{m.text}</p>
                {m.chips && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {m.chips.map((c) => (
                      <button
                        key={c}
                        onClick={() => send(c)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-secondary"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-row-reverse gap-3">
              <div className="rounded-2xl rounded-tr-none bg-primary p-4 shadow-glow">
                <p className="text-sm text-primary-foreground">{m.text}</p>
              </div>
            </div>
          ),
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
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
            onChange={(e) => setInput(e.target.value)}
            type="text"
            placeholder="Ask about specific parts or performance..."
            className="w-full rounded-xl border border-border bg-background px-5 py-4 pr-14 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            aria-label="Send"
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow transition-all hover:bg-primary-glow"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}
