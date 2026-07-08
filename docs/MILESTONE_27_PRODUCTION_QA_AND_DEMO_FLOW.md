# Milestone 27: Production QA and Demo Flow

## Goal

Prepare AI PC Build Advisor for deployment, stakeholder demos, and early user testing without adding major new product features. This milestone is a lightweight production-readiness pass: align the demo story, define repeatable QA coverage, and preserve the current MVP architecture.

## Current MVP Status

- `/consult` is the primary demo surface for chat-driven build recommendations, build needs capture, current build review, and part replacement.
- Build recommendations are generated from local rule-based logic using budget, use case, style, experience level, and brand preference.
- Compatibility, price totals, replacement impact, purchase references, usage limits, and saved-build behavior remain deterministic and app-owned.
- The AI advisor can use either the mock provider or the OpenAI provider. If the OpenAI provider is not configured or fails, the mock provider keeps the demo usable.
- Structured advisor responses are visible in the chat panel and preserve concise sections for recommendation, fit, budget impact, compatibility impact, tradeoffs, and next action when compare context is active.
- Part compare and replacement flows support local demo catalog alternatives, preview impact, compare selections, and confirmed swaps.
- Retailer results, live stock, live pricing, payment checkout, and long-term persistence are intentionally not part of this milestone.

## Main Demo Flow

1. Open `/consult`.
2. Confirm the build card, Build Needs panel, usage badge, purchase references, compatibility state, and advisor chat render without errors.
3. Reset demo state before a formal walkthrough if previous local testing changed plan, usage, saved builds, or selected parts.
4. Run the `$1500 budget gaming PC` prompt and apply any relevant advisor action chips. Confirm the build updates around budget-conscious choices and shows clear budget pressure.
5. Run the `$2000 1440p high refresh gaming PC` prompt. Confirm the recommendation focuses on gaming performance and the build card reflects the updated budget/use case.
6. Run the `White aesthetic PC build` prompt. Confirm style preferences are captured and the build summary or selected parts reflect the aesthetic preference where the demo catalog supports it.
7. Open GPU compare from the build card.
8. Use `Upgrade GPU from 5070 Ti to 5080` as the advisor or compare-context scenario. Confirm the compare panel explains price, performance, and compatibility impact before replacement.
9. Preview the GPU swap before confirming it. Confirm total price, budget delta, compatibility warnings, and purchase references are understandable.
10. Confirm the replacement. Verify the build card total, compatibility state, and replacement usage update after the swap.
11. Ask the advisor `Why was this GPU recommended?` while the compare panel is open. Confirm the response uses structured sections and references current build context.
12. Ask the advisor `Can you suggest a cheaper alternative?` Confirm the response names a practical tradeoff and does not claim live discounts or retailer stock.
13. Narrow the browser viewport to mobile width and repeat the key actions: send a prompt, inspect the build card, open compare, preview a replacement, and read an advisor answer.

## Test Prompts

Use these prompts during local QA and demos:

- `I have a $1500 budget and want a gaming PC for Fortnite, Valorant, and Cyberpunk.`
- `Build me a $2000 1440p high refresh gaming PC. I care about smooth frame rates more than streaming.`
- `I want a white aesthetic PC build with clean cable management and RGB, but keep it practical.`
- `Upgrade the GPU from a 5070 Ti to a 5080. What changes?`
- `Why did you recommend this CPU and GPU combination?`
- `Can you suggest a cheaper alternative that keeps this build good for 1440p gaming?`
- `Will this power supply have enough headroom after the GPU upgrade?`
- `What compatibility risk should I pay attention to before buying?`
- `I am new to PC building. Explain the tradeoff in plain English.`

## Manual QA Checklist

- Chat-driven build recommendation: Send budget, use case, style, and brand-preference prompts. Confirm Build Needs update, advisor messages stay readable, and action chips apply the intended updates.
- Build card rendering: Confirm selected parts, total price, budget remaining or overage, compatibility status, confidence, recommendation notes, and purchase references render on initial load and after updates.
- Part compare drawer: Open compare from CPU, GPU, memory, storage, case, cooler, and PSU rows where alternatives exist. Confirm empty categories show friendly copy instead of broken UI.
- Part replacement flow: Preview a replacement, inspect the impact, then confirm it. Confirm replacement usage is consumed only after a successful confirmed replacement.
- Compatibility impact: Confirm compatibility warnings and pass states update after swaps, especially GPU and PSU changes.
- Budget/price impact: Confirm total price, budget delta, over-budget labels, purchase references, and cheaper/upgrade labels update after swaps.
- Structured AI advisor response rendering: Ask a compare-context question and confirm response sections are preserved with readable line breaks in the chat panel.
- Mobile/narrow layout behavior: Test `/consult` around 390px wide. Confirm chat, build card, compare panel, sticky/tray controls, and buttons remain usable without text overlap.
- Empty states: Confirm missing compare alternatives, no search results, no retailer preview results, and unselected compare states show helpful copy.
- Error states: Temporarily use mock mode or simulate an advisor fallback. Confirm the user still receives a safe response and the app does not expose provider details.
- Loading states: Confirm advisor send, compare loading, replacement preview, and replacement confirm states disable or communicate pending work without duplicating actions.
- Demo reset: Use Reset demo state and confirm usage, replacement count, Pro state, saved builds, and selected demo build return to the expected local baseline.

## Deployment Checklist

- Run `npm.cmd run build` locally and confirm it completes successfully.
- Confirm `.env.local` or deployment environment variables are not committed.
- For mock demo deployments, set `AI_PROVIDER=mock` or omit provider variables and verify the fallback advisor path works.
- For OpenAI-backed demos, configure server-only `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and optionally `AI_PROVIDER_MODEL`. Restart/redeploy after changes.
- Confirm Supabase variables are present only if the deployment is intended to use production persistence. Otherwise verify mock persistence is acceptable for the demo.
- Confirm Stripe/payment variables are not required for this milestone and that checkout/payment claims are not included in the demo script.
- Smoke test `/`, `/consult`, `/build`, `/compare`, `/cart`, `/checkout/success`, and `/checkout/cancel` after deployment.
- Verify browser console and server logs do not show API keys, provider payloads, or repeated runtime errors during the demo flow.
- Confirm the deployed copy does not imply live retailer price, stock, shipping, payment, or checkout behavior.

## Known Limitations

- Prices, availability, and purchase references are demo estimates, not live retailer data.
- No real retailer integration has been added in this milestone.
- No payment or cart checkout integration has been added in this milestone.
- The demo catalog is intentionally limited, so some aesthetics or part requests may be approximated by the closest available local part.
- AI guidance can explain and suggest, but compatibility checks, pricing impact, and replacement application remain rule-based.
- OpenAI-backed responses depend on deployment configuration. The mock provider remains the safe fallback.
- Supabase-backed persistence depends on existing environment configuration; this milestone does not change the schema.
- Mobile QA is manual and viewport-based; automated browser coverage is still a future improvement.

## Suggested Next Milestone

Milestone 28 should add focused automated confidence checks for the demo path without changing the product surface. Good candidates are Playwright smoke tests for `/consult`, build recommendation prompts, compare opening, replacement preview, structured advisor rendering, and narrow viewport layout checks.
