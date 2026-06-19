# Milestone 8: AI Adapter Integration

## What Was Added

Milestone 8 adds a backend AI adapter layer for the advisor chat while keeping the app usable without external services.

Added files:

- `src/lib/ai/types.ts`
- `src/lib/ai/mock-provider.ts`
- `src/lib/ai/openai-provider.ts`
- `src/lib/ai/advisor-service.ts`
- `.env.example`

Added endpoint:

```txt
POST /api/ai/advisor
```

## AI Architecture

The frontend sends advisor chat messages to the internal API only. API keys are read on the backend through server-only configuration.

Flow:

1. Frontend sends user message, current build, collected needs, plan, and usage context.
2. Internal API checks current mock usage.
3. If usage is available, the API consumes one AI question.
4. Advisor service chooses a configured provider or falls back to the mock provider.
5. Response returns safe suggestions and extracted needs.
6. Frontend may refresh the rule-based build using extracted needs.

The AI response never directly replaces parts.

## Mock Fallback Behavior

If no API key is configured, or if the AI provider request fails, the advisor service uses the local mock provider.

The mock provider:

- Parses budget, use case, style, experience level, and brand preference locally.
- Returns a friendly assistant message.
- Returns safe suggested actions such as opening Part Explorer.
- Does not change compatibility, prices, purchase links, or selected parts directly.

## Usage Limit Integration

The advisor endpoint uses the same Milestone 6 usage limits:

- Free: 5 AI questions per day
- Build Pro: 50 AI questions per build

If usage is exhausted, the endpoint returns a friendly upgrade response and does not consume usage.

The frontend updates `UsageBadge` from the advisor response.

## Environment Variable Setup

Create a local `.env.local` or platform secret with:

```txt
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER_API_KEY=your_generic_ai_provider_key_here
AI_PROVIDER_MODEL=gpt-4.1-mini
```

Only server-side code reads these values. Do not prefix secrets with `VITE_`.

## Safety Rule

Compatibility remains rule-based.

The AI adapter may explain or suggest, but it must not be treated as the source of truth for:

- Compatibility checks
- Pricing
- Part replacement
- Purchase references
- Stock or retailer data

Those flows continue to use deterministic app logic and mock catalog data.

## Future TODOs

- Add provider-specific structured output validation.
- Add provider routing by plan and request complexity.
- Persist AI usage with real users.
- Add response caching for repeated advisor prompts.
- Add observability for fallback rate and provider errors.
- Expand safe suggested actions for opening a specific Part Explorer category.
