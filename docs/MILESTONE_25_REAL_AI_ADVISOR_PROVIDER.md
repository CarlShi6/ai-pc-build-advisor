# Milestone 25: Real AI Advisor Provider Integration

## Provider Architecture

The advisor endpoint stays at `POST /api/ai/advisor`, so the frontend response contract remains unchanged. The server now routes advisor requests through a provider layer:

- `src/lib/ai/advisor-provider.ts` selects the active provider.
- `src/lib/ai/providers/mock-advisor-provider.ts` wraps the existing deterministic mock advisor.
- `src/lib/ai/providers/openai-advisor-provider.ts` calls OpenAI with the installed JavaScript SDK.
- `src/lib/ai/providers/types.ts` exposes the shared provider contracts.

The OpenAI provider receives the user message, recent conversation history, collected needs, current build, budget and use case from the build, usage plan context, and the active compare context from the non-blocking compare UI. Compare context includes the selected part, candidate parts, price difference, candidate total build price, and compatibility impact calculated by the local rule engine.

## Environment Variables

All AI provider variables are server-only. Do not prefix them with `VITE_`.

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `mock` or `openai`. Missing values behave like `mock`. |
| `OPENAI_API_KEY` | Preferred API key for the OpenAI provider. |
| `AI_PROVIDER_API_KEY` | Fallback key used only when `OPENAI_API_KEY` is missing. |
| `AI_PROVIDER_MODEL` | OpenAI model name. Defaults to `gpt-4.1-mini` when missing. |

## Local Setup

For local mock development:

```env
AI_PROVIDER=mock
```

For local OpenAI testing:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
AI_PROVIDER_MODEL=gpt-4.1-mini
```

Restart the dev server after changing environment variables.

## Fallback Behavior

The mock advisor is used when:

- `AI_PROVIDER` is missing.
- `AI_PROVIDER=mock`.
- `AI_PROVIDER` is unsupported.
- `AI_PROVIDER=openai` but no API key is configured.
- The OpenAI request fails or returns an unsupported response shape.

When OpenAI fails after being selected, the server logs a sanitized error message and returns a normal advisor response from the mock provider with `fallbackUsed: true`.

## Security Notes

The frontend never imports provider configuration or API keys. AI provider settings are read through `src/lib/config.server.ts`, which is a server-only module. The browser sends only user and app context to `/api/ai/advisor`; the server attaches provider credentials when it calls OpenAI.

Logs intentionally avoid printing API keys, request headers, or raw provider payloads. Keep `OPENAI_API_KEY` and `AI_PROVIDER_API_KEY` out of committed files and deployment logs.
