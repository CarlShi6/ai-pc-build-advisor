# Milestone 31: Product Definition and Interaction System

## Goal

Define AI PC Build Advisor as a deployable, commercial-ready AI PC configuration and part decision platform. The product turns confusing PC part choices into clear, comparable, and purchase-ready PC builds.

This milestone establishes product strategy, user journeys, interaction roles, visual direction, monetization direction, and the near-term roadmap. It does not add product features or change application behavior.

## Product Vision

AI PC Build Advisor is an AI-powered PC configuration and part decision platform. It helps buyers move from an uncertain goal or a confusing set of component options to a complete build they understand, can compare, and are ready to purchase.

The product should make PC buying feel guided rather than fragmented. It should explain why a part fits, show the consequences of alternatives, maintain the context of the full build, and turn recommendations into actionable purchase decisions.

## Target User

The primary user is a PC buyer who understands the basics of PC hardware but struggles to choose between similar parts, especially GPUs and CPUs, while building a new PC or upgrading an existing one.

This user may recognize model tiers, common specifications, and major brands, but still needs help connecting those details to real workloads, performance goals, budget, compatibility, and overall build value. The product is not limited to first-time builders; it should also support informed enthusiasts who want a faster, clearer decision process.

## Core Pain Points

- Users do not know how to choose between similar GPU or CPU models.
- Users understand some specifications but do not know which specifications matter for their needs.
- Users often leave PCPartPicker or retailer pages to ask AI for explanations and recommendations.
- Users worry about compatibility, budget tradeoffs, and whether an upgrade is worth it.
- Users want a complete build, but also need single-part comparison and replacement.

These problems are connected. A part cannot be evaluated only as an isolated product: its value depends on the user's goals, its alternatives, and its impact on the rest of the build.

## Product Positioning

AI PC Build Advisor combines:

- AI chat for conversational guidance and explanations.
- A PCPartPicker-like build system for structured configuration and compatibility context.
- Micro Center-style purchase guidance for practical choices, alternatives, and buying confidence.

The product should feel like a knowledgeable PC advisor working inside a structured configurator, not like a generic chatbot placed beside a parts list.

## Difference From PCPartPicker

PCPartPicker helps users organize parts and check compatibility.

AI PC Build Advisor helps users understand tradeoffs, compare alternatives, and make confident purchase decisions.

The products can serve adjacent needs, but AI PC Build Advisor differentiates itself through decision support. Its primary value is explaining which option is better for a specific user, what changes when a part is replaced, and whether the performance or capability gained justifies the cost.

## Core User Journey

1. **Onboarding prompt:** The product invites the user to describe what they want to build, upgrade, compare, or improve.
2. **AI-guided needs collection:** The advisor gathers the minimum useful context, including workload, performance target, budget, preferences, existing parts, and constraints.
3. **Recommended full build:** The product presents a complete, coherent build with clear reasoning and a visible budget.
4. **GPU/CPU comparison and replacement:** The user can focus on the most decision-intensive parts, compare alternatives, and preview a replacement.
5. **Compatibility and budget impact:** Every proposed change is explained in the context of compatibility, total price, performance goals, and the rest of the build.
6. **Purchase-ready shopping list:** The selected configuration becomes a clear list of parts, prices, retailer references, and purchase links where available.

The journey should support both directions: a user can begin with a complete-build request and refine individual parts, or begin with a single-part decision and expand it into a compatible build.

## Interaction Model

### Onboarding

Onboarding establishes intent and reduces blank-page friction. It should help the user begin with a natural request such as building within a budget, choosing between two parts, upgrading an existing component, or targeting a specific game or workload. It should collect only the context needed to produce a useful first recommendation.

### Chat Assistant

The chat assistant is the reasoning and guidance layer. It asks focused questions, explains relevant specifications, interprets tradeoffs, and recommends next actions. It should remain grounded in the active build and comparison state so its advice is specific, consistent, and actionable.

### Live Build Card

The live build card is the persistent configuration state. It shows the current recommended parts, total budget, and important compatibility context while the conversation evolves. It gives the user a stable object to inspect and modify rather than leaving recommendations only in chat history.

### Compare System

The compare system is the primary decision workspace for evaluating alternatives. It translates specifications, price differences, and build consequences into a clear recommendation. It should connect every comparison to the user's stated needs and the active full build.

### Shopping List

The shopping list is the handoff from decision to purchase. It consolidates the chosen configuration into an actionable, reviewable list with quantities, prices, retailer references, product links where available, and final compatibility context. It should preserve trust by distinguishing verified purchase information from estimates or reference data.

## Compare System Definition

Compare is a core decision tool, not merely a specification table. For any two or more alternatives, it should answer:

- Which one should I choose?
- What do I gain?
- What do I lose?
- Is it worth the price difference?
- What changes in my full build?

The comparison should prioritize the factors relevant to the user's goals, state the recommendation directly, and expose the reasoning behind it. It should account for performance, features, price, compatibility, power and supporting-component implications, and total-build impact where applicable.

## Visual Direction

The future visual direction is **Professional Gaming Configurator**: clean, premium, technical, and slightly gaming, but not too neon and not too blue.

The interface should communicate expertise and purchasing confidence without resembling either an enterprise dashboard or an exaggerated gaming control panel. Dense technical information should remain calm, readable, and clearly prioritized.

Two possible style directions should be explored:

### Light Professional With Green Accent

A bright, retail-friendly foundation with neutral surfaces, strong typography, restrained borders, and green used for recommendations, selected states, positive compatibility, and primary actions. This direction prioritizes approachability, product clarity, and broad commercial appeal.

### Dark Technical With Green Accent

A dark, premium foundation with layered neutral surfaces, crisp data presentation, controlled contrast, and green used as the main decision and action signal. This direction can feel more enthusiast-oriented while remaining professional and avoiding excessive neon, blue glow, or decorative effects.

## Monetization Direction

Affiliate links are the first monetization path. Purchase-ready recommendations and shopping lists can connect users to relevant retailer product pages while keeping decision quality and user trust primary.

Affiliate implementation should eventually favor transparent link treatment, accurate product matching, and retailer choice. Monetization must not distort comparisons or make sponsored value indistinguishable from product advice.

A B2B retailer or in-store assistant is a future possibility. The same guided needs collection, comparison reasoning, build configuration, and shopping-list model could support store associates or retailer customers, but this is not the immediate focus.

## Roadmap

### Milestone 32: Compare-first UX Redesign

Make comparison and confident part selection the central product workflow, with clear connections among chat, the active build, alternatives, and replacement impact.

### Milestone 33: Visual System Upgrade

Establish the Professional Gaming Configurator design system and apply the selected light or dark direction consistently across the product.

### Milestone 34: Public MVP Landing and Onboarding

Create a public-facing product entry point that communicates the value proposition and guides new users into a relevant build, upgrade, or comparison journey.

### Milestone 35: Affiliate-ready Purchase Link Strategy

Define trustworthy retailer-link behavior, product matching requirements, disclosure standards, and purchase-list readiness for affiliate monetization.

## Milestone Scope and Constraints

- Documentation only.
- No application code changes.
- No new product features or behavior changes.
- No external services.
- No Supabase schema changes.
- No build is required because this milestone does not change executable code.
