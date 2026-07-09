# Milestone 30: Demo Polish and Deployment Verification

## Goal

Polish the AI PC Build Advisor MVP for a first-time demo and verify that the production build and deployed app flow are ready to show. This milestone does not add major product features or new external services.

## Demo-Ready User Flow

1. Open the consult page.
2. Confirm the initial build recommendation loads.
3. Pick a demo starter prompt in the chat.
4. Review the advisor response and any suggested actions.
5. Use Compare / Replace on a CPU or GPU row.
6. Preview a part replacement and confirm the swap.
7. Open the shopping list from the build card.
8. Review purchase references and product metadata.
9. Save the build using the purchase reference section.
10. Check the same flow in a narrow/mobile viewport.

## Preset Demo Prompts

- Build me a $1500 gaming PC for 1080p/1440p.
- I want a $2000 1440p high refresh gaming PC.
- I want a white aesthetic PC build.
- Should I upgrade from a 5070 Ti to a 5080?
- Give me a cheaper alternative without losing too much performance.

## Manual QA Checklist

- Empty chat state shows compact demo starter prompts.
- Chat loading state is visible while the advisor is responding.
- Advisor error state keeps the current build visible and gives a retry path.
- Initial build loading state is understandable.
- Empty build state explains that the advisor must generate a recommendation.
- Compare drawer empty state tells the user to choose a build part.
- Compare drawer loading and error states are clear.
- Part replacement preview and confirmation still work.
- Shopping list empty or unavailable state is clear.
- Purchase reference list loading and empty states are clear.
- Build card action labels are easy to understand.
- Compare and shopping-list entry points are visible from the build card.
- Product metadata such as retailer, stock, key specs, and product links display where available.
- Narrow/mobile layout remains usable without overlapping controls.

## Deployment Verification Checklist

- Run `npm.cmd run build`.
- Run the local demo flow on the consult page.
- Verify the deployed app loads.
- Verify chat recommendation works.
- Verify compare drawer works.
- Verify part replacement works.
- Verify shopping list works.
- Verify product metadata displays.
- Verify mobile/narrow layout.
- Verify there are no console-breaking errors.

## Production Environment Variables To Verify

- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `AI_PROVIDER_API_KEY`
- `AI_PROVIDER_MODEL`
- `PERSISTENCE_PROVIDER`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_BUILD_PRO_PRICE_ID`
- `PUBLIC_APP_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SMOKE_TEST_ENABLED`

## Known Limitations

- Retailer data is demo/mock metadata, not live inventory.
- There is no real checkout or payment completion flow in the advisor experience.
- External retailer websites are not scraped.
- Authentication and Supabase schema are unchanged in this milestone.
- Advisor availability depends on the configured provider and environment.
- Product links and prices should be treated as purchase references, not final checkout data.

## Suggested Next Milestone

Milestone 31 should focus on production observability and post-demo hardening: structured client/server error reporting, deployed smoke tests, and a short regression script for the advisor, compare drawer, replacement flow, and shopping list.
