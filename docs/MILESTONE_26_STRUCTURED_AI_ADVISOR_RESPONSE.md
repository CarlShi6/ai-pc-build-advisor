# Milestone 26: Structured AI Advisor Response Quality

## What Changed

Milestone 26 makes advisor replies feel like PC build guidance instead of a generic chat answer. The OpenAI provider now uses a dedicated response-quality prompt builder that tells the model to write concise, beginner-friendly advice with predictable sections.

The chat UI now preserves line breaks, so structured answers remain scannable in the compact advisor panel. The mock fallback still works and now mirrors the same visible response shape while keeping its deterministic local parsing and suggested actions.

## Response Structure

When an active compare context is present, the advisor uses:

- `Recommendation`
- `Fit`
- `Budget impact`
- `Compatibility impact`
- `Performance tradeoff`
- `Next action`

When the user asks a general build question, the advisor uses:

- `Direct answer`
- `Reasoning`
- `Practical recommendation`
- `Next step`

Each section is intentionally short so the answer fits the chat surface without turning into a long article.

## Context Used

The OpenAI provider receives server-shaped app context, including:

- The current user message and recent conversation history.
- Collected needs such as budget, use case, style, experience level, and brand preference.
- The current build, total price, compatibility status, compatibility warnings, confidence score, and selected parts.
- Active compare context when the compare drawer is open.
- Candidate compare details calculated by the local rule engine, including price difference, candidate build total, compatibility warnings, and confidence score.

The model is instructed to use this context when available and to avoid pretending it knows live stock, exact market prices, discounts, delivery dates, or availability.

## Safety And Trust Guardrails

Pricing and availability are treated as app-provided estimates, not live retail truth. Compatibility remains grounded in the deterministic local rule engine. The advisor can explain, recommend, and suggest actions, but it does not directly replace parts.

Provider secrets remain server-only. `OPENAI_API_KEY` and `AI_PROVIDER_API_KEY` are still read through `src/lib/config.server.ts` and are never exposed to the frontend bundle.

## Why This Improves The Advisor Moat

The product advantage is not just access to an LLM. It is the combination of LLM explanation, build-specific context, deterministic compatibility checks, and an action model that keeps users inside a safe purchase workflow.

Structured responses make that advantage visible. A beginner can quickly see the recommendation, why it fits, what it does to budget, what compatibility risk exists, what tradeoff they are making, and what to do next. That turns the advisor from a generic answer box into a guided PC-building decision layer.
