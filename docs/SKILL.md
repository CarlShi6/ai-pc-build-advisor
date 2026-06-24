# AI装机助手 / AI PC Build Advisor Skill

Version: 6.0.0
Project Type: B2C Full-Stack Monetization MVP
Frontend Source: Lovable exported React project, now upgraded in local GitHub repo
Implementation Agent: Codex
Current Milestone: Milestone 6 — B2C Monetization MVP

---

## 1. Product Goal

AI装机助手 / AI PC Build Advisor is a B2C web app for regular PC buyers.

The product helps beginner and intermediate users configure a custom PC by understanding their budget, use case, performance needs, appearance preferences, and technical comfort level.

The app should help users:

* Collect PC build needs through a guided chat or form-like assistant
* Generate a recommended PC build
* Understand why each part was selected
* Compare multiple PC components in the same category
* Replace parts and immediately see price and compatibility changes
* Check compatibility risks
* Generate a purchase reference list
* Unlock advanced analysis through a Build Pro upgrade
* Click affiliate purchase links when they are ready to buy

This project should no longer prioritize retail employee workflows, in-store sales scripts, or B2B sales summaries.

B2B/B2B2C ideas can remain as future expansion, but the current implementation should focus on individual consumers.

---

## 2. Target Users

### 2.1 Beginner PC Buyers

Users who want to build or buy a PC but do not fully understand PC parts.

They need:

* Simple explanations
* Clear recommendations
* Budget control
* Compatibility warnings
* Easy part comparison
* Confidence before buying
* A purchase-ready parts list

### 2.2 Intermediate PC Buyers

Users who know some PC hardware but still want help comparing options.

They need:

* More part alternatives
* Side-by-side specs
* Performance and value tradeoffs
* Upgrade and downgrade options
* Compatibility checks
* Clear reasoning before replacing parts

---

## 3. Core Product Direction

The current product direction is B2C-first.

The app should feel like a consumer product for people who are trying to make a good PC buying decision.

The product should not feel like:

* A retail employee tool
* A sales CRM
* A quote-generation tool for store staff
* A B2B procurement system
* A generic AI chatbot

The product should feel like:

* A helpful PC buying assistant
* A guided build recommender
* A compatibility checker
* A part comparison tool
* A purchase-preparation assistant

---

## 4. Core Layout

The app should keep the current Lovable visual style and main layout.

Core layout:

* Left side: AI-style build assistant or guided requirement panel
* Right side: live PC build recommendation card
* Configuration list inside the recommendation card
* Clickable component rows
* Part comparison drawer or modal
* Purchase reference list
* Compatibility summary
* Upgrade prompts only where they are contextually useful

The UI should feel modern, consumer-facing, and trustworthy.

Monetization UI should be subtle and helpful. It should not feel aggressive, spammy, or dark-patterned.

---

## 5. Monetization Model

The MVP monetization model has three layers:

1. Free Plan
2. Build Pro one-time unlock
3. Affiliate purchase links

The product should not try to sell raw AI tokens to users.

Instead, it should sell confidence, convenience, comparison depth, and purchase readiness.

---

## 6. Free Plan

Free users can:

* Generate a basic PC build
* View basic compatibility information
* Use a limited number of AI-style questions
* View basic part comparison fields
* Replace parts within normal limits
* View purchase links
* Click affiliate purchase links

Free users should have enough value to understand the product, but advanced reasoning should be locked behind Build Pro.

Recommended free usage limit:

* 5 AI questions per day
* Basic comparison only
* No full purchase checklist
* No advanced AI reasoning
* No full export/save-ready flow

The UI should show free usage as user-friendly limits, not as tokens.

Example:

```txt
3 AI questions remaining today
```

Do not expose token counts to users.

---

## 7. Build Pro

Build Pro is a one-time unlock.

Target price:

```txt
$7.99 one-time
```

Build Pro unlocks:

* Advanced part comparison
* AI reasoning for every recommendation
* Purchase-ready checklist
* Better upgrade/downgrade decisions
* Final recommendation explanations
* Export/save-ready build experience
* Higher AI usage limits

Recommended Pro usage limit:

* 50 AI questions per build

Build Pro should not require real Stripe integration in Milestone 6.

For Milestone 6, implement mock checkout and mock entitlement first.

The code should be structured so real Stripe Checkout can be added later.

---

## 8. Affiliate Purchase Links

Parts may include purchase links to merchants.

Supported merchant values:

* amazon
* newegg
* microcenter
* bestbuy
* bhphoto
* other

Affiliate links must be disclosed clearly.

Disclosure text:

```txt
Some links may earn us a commission at no extra cost to you.
```

This disclosure should appear near purchase buttons, purchase reference lists, or footer areas where purchase links are shown.

The app must not claim real-time price or stock unless real data is actually fetched.

For MVP, placeholder URLs and mock retailer data are acceptable.

Affiliate clicks should be tracked through the internal mock API.

---

## 9. Token and AI Usage Control

AI usage must be controlled by product-level limits.

The app should not expose token usage directly to users.

Instead, AI usage should be controlled through:

* Daily AI question limits for free users
* Per-build AI question limits for Pro users
* Feature access rules
* Model-routing-ready architecture
* Usage logging

Recommended usage rules:

```txt
Free users: 5 AI questions per day
Pro users: 50 AI questions per build
```

When a free user reaches the limit, the app should show a soft upgrade prompt.

The app should not crash.

The app should not break the existing mock recommendation behavior.

The app should remain usable even if AI usage is exhausted.

---

## 10. Free vs Pro Feature Rules

### Free Users Can See

* Part name
* Price
* Basic performance score
* Basic compatibility status
* Basic recommendation summary
* Purchase links
* Basic purchase reference list

### Pro-Only Features

* AI recommendation reason
* Value analysis
* Performance fit explanation
* Compatibility impact
* Upgrade/downgrade explanation
* Final recommendation
* Full purchase checklist
* Export/save-ready flow
* Higher AI usage limit
* More advanced swap/comparison guidance

---

## 11. MVP Features

### 11.1 Build Assistant

The assistant should collect:

* Budget
* Use case
* Gaming resolution
* Productivity workload
* AI / creator workload if relevant
* Appearance preference
* Brand preference
* Existing parts
* Technical familiarity
* Upgrade flexibility

For MVP, the assistant can use mock logic and does not need a real LLM connection yet.

AI integration should be designed as a future adapter, but the MVP should work without a live AI API.

### 11.2 Live Build Recommendation

The build card should show:

* Build name
* Total estimated price
* Target use case
* CPU
* GPU
* Motherboard
* RAM
* SSD
* PSU
* Case
* Cooler
* Compatibility status
* Short recommendation explanation

The configuration list should be data-driven, not hard-coded.

### 11.3 Part Compare Drawer

When the user clicks a component row, such as GPU, CPU, motherboard, memory, SSD, PSU, case, or cooler, open a Part Compare Drawer.

The drawer should support more than a simple one-part swap.

The drawer should show:

* Current selected part
* A larger list of same-category alternatives
* Basic sorting or filtering
* Multi-select comparison
* Side-by-side comparison table
* Price difference from current part
* Performance fit
* Value rating
* Compatibility notes
* Recommendation reason
* Replace button

The user should be able to compare at least 2–4 same-category parts side by side.

When a part is replaced:

* Build total price updates
* Compatibility warnings update
* Purchase reference list updates
* Recommendation notes update

---

## 12. Compare Drawer Monetization Rules

The Compare Drawer should support a freemium experience.

### Free User Experience

Free users can see:

* Part name
* Price
* Basic score
* Basic specs
* Basic compatibility status

Free users should see locked previews for advanced fields.

Locked fields should use a ProFeatureLock component.

Locked Pro fields:

* AI recommendation reason
* Value analysis
* Performance fit
* Compatibility impact
* Upgrade/downgrade explanation
* Final recommendation

The locked state should be clear but not aggressive.

Example copy:

```txt
Unlock Build Pro to see advanced reasoning, value analysis, and compatibility impact.
```

### Pro User Experience

Pro users can see:

* Full comparison details
* Recommendation reasoning
* Value analysis
* Performance fit
* Compatibility impact
* Upgrade/downgrade explanation
* Final suggestion

---

## 13. Purchase Checklist

The purchase checklist is a Pro-only feature.

Checklist items:

* Confirm CPU and motherboard socket compatibility
* Confirm RAM type
* Confirm PSU wattage
* Confirm GPU clearance
* Confirm case and cooler fit
* Confirm storage slots
* Confirm Windows/license plan
* Confirm monitor resolution target

Free users may see a locked preview.

Pro users should see the full checklist.

The checklist should help users avoid expensive purchasing mistakes.

---

## 14. Category-Specific Comparison Fields

The comparison drawer should use category-specific specs.

### CPU Comparison

CPU comparison should include:

* Cores
* Threads
* Socket
* Gaming score
* Productivity score
* Power draw
* Price
* Recommendation reason

### GPU Comparison

GPU comparison should include:

* Chipset
* VRAM
* 1440p gaming score
* 4K gaming score
* Power draw
* Card length
* Color
* Price
* Recommendation reason

### Motherboard Comparison

Motherboard comparison should include:

* Socket
* Chipset
* Form factor
* Wi-Fi support
* PCIe support
* Memory support
* Price

### RAM Comparison

RAM comparison should include:

* Capacity
* DDR type
* Speed
* Latency
* Color
* Price

### SSD Comparison

SSD comparison should include:

* Capacity
* Interface
* Read speed
* Write speed
* Price

### PSU Comparison

PSU comparison should include:

* Wattage
* Efficiency rating
* Modularity
* Native 12VHPWR or 12V-2x6 support
* Price

### Case Comparison

Case comparison should include:

* Form factor support
* GPU clearance
* Radiator support
* Color
* Price

### Cooler Comparison

Cooler comparison should include:

* Cooler type
* Air cooler height or radiator size
* Socket support
* Noise level
* Price

---

## 15. Compatibility Check

MVP compatibility rules should check:

* CPU socket vs motherboard socket
* Motherboard RAM type vs RAM type
* PSU wattage vs estimated system wattage
* GPU length vs case clearance
* Case form factor vs motherboard form factor
* Cooler height or radiator fit vs case clearance
* PSU connector support for modern GPUs

Compatibility warnings should never be hidden.

Compatibility checks should be rule-based and deterministic.

Do not rely only on AI to determine compatibility.

AI can explain compatibility results later, but rule-based checks should remain the source of truth.

---

## 16. Purchase Reference List

The app should generate a purchase reference list with:

* Part name
* Retailer
* Estimated price
* Product URL or search URL
* Quantity
* Availability status
* Note

The app must not perform real checkout or payment.

The MVP can use mock retailer data and search URLs.

The app should not claim real-time pricing or stock unless real data is actually fetched.

Purchase links should trigger affiliate click tracking.

---

## 17. Data Models

Use TypeScript types.

### 17.1 PartCategory

```ts
export type PartCategory =
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "ssd"
  | "psu"
  | "case"
  | "cooler"
  | "os"
  | "fan"
  | "accessory";
```

### 17.2 AffiliateMerchant

```ts
export type AffiliateMerchant =
  | "amazon"
  | "newegg"
  | "microcenter"
  | "bestbuy"
  | "bhphoto"
  | "other";
```

### 17.3 AffiliateLink

```ts
export interface AffiliateLink {
  merchant: AffiliateMerchant;
  url: string;
  price?: number;
  inStock?: boolean;
  label?: string;
}
```

### 17.4 Part

```ts
export interface Part {
  id: string;
  category: PartCategory;
  brand: string;
  model: string;
  displayName: string;
  price: number;
  retailer?: string;
  productUrl?: string;
  searchUrl?: string;
  affiliateLinks?: AffiliateLink[];
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  specs: Record<string, string | number | boolean>;
  compatibilityTags: string[];
  recommendationReason?: string;
  pros?: string[];
  cons?: string[];
  valueScore?: number;
  performanceScore?: number;
}
```

### 17.5 Build

```ts
export interface Build {
  id: string;
  name: string;
  targetUseCase: string[];
  budget: number;
  totalPrice: number;
  parts: Part[];
  compatibilityStatus: "pass" | "warning" | "fail";
  compatibilityWarnings: CompatibilityWarning[];
  recommendationSummary?: string;
}
```

### 17.6 CompatibilityWarning

```ts
export interface CompatibilityWarning {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  affectedPartIds: string[];
  suggestedFix?: string;
}
```

### 17.7 PurchaseListItem

```ts
export interface PurchaseListItem {
  partId: string;
  displayName: string;
  retailer: string;
  estimatedPrice: number;
  quantity: number;
  productUrl?: string;
  searchUrl?: string;
  affiliateLinks?: AffiliateLink[];
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  note?: string;
}
```

---

## 18. Monetization Data Models

### 18.1 PlanType

```ts
export type PlanType = "free" | "build_pro";
```

### 18.2 FeatureKey

```ts
export type FeatureKey =
  | "advanced_compare"
  | "ai_reasoning"
  | "purchase_checklist"
  | "build_export"
  | "unlimited_swaps";
```

### 18.3 UsageLimit

```ts
export interface UsageLimit {
  aiQuestionsPerDay?: number;
  aiQuestionsPerBuild?: number;
  maxCompareParts?: number;
  canUseAdvancedCompare: boolean;
}
```

### 18.4 Entitlement

```ts
export interface Entitlement {
  userId: string;
  plan: PlanType;
  buildId?: string;
  active: boolean;
  startedAt: string;
  expiresAt?: string;
}
```

### 18.5 UsageStatus

```ts
export interface UsageStatus {
  userId: string;
  plan: PlanType;
  aiQuestionsUsedToday: number;
  aiQuestionsLimitToday?: number;
  aiQuestionsUsedForBuild?: number;
  aiQuestionsLimitForBuild?: number;
  remainingAiQuestions: number;
  canAskAiQuestion: boolean;
}
```

### 18.6 CheckoutResult

```ts
export interface CheckoutResult {
  success: boolean;
  plan: PlanType;
  entitlement?: Entitlement;
  message?: string;
}
```

### 18.7 AffiliateClickEvent

```ts
export interface AffiliateClickEvent {
  userId?: string;
  buildId?: string;
  partId: string;
  merchant: AffiliateMerchant;
  url: string;
  clickedAt: string;
}
```

---

## 19. Monetization Config

Create a monetization helper file:

```txt
src/lib/monetization.ts
```

It should define:

* FREE_PLAN
* BUILD_PRO_PLAN
* feature access rules
* usage limits
* helper functions

Recommended helpers:

```ts
getPlanForEntitlement(entitlement)
canUseFeature(plan, featureKey)
getRemainingAiQuestions(usageStatus)
formatUpgradeMessage(featureKey)
```

Recommended plan rules:

```ts
Free:
- 5 AI questions per day
- Basic compare only
- No purchase checklist
- No export/save-ready flow

Build Pro:
- 50 AI questions per build
- Advanced compare
- AI reasoning
- Purchase checklist
- Export/save-ready flow
```

---

## 20. Internal API Requirements

If the current project already has an internal API layer, keep using it.

Milestone 6 should extend the existing internal API system.

Add mock endpoints:

```txt
GET /api/usage/status
POST /api/usage/consume
GET /api/entitlement/status
POST /api/checkout/mock-upgrade
POST /api/affiliate/click
```

Because there is no real auth yet, use a temporary mock user/session.

Acceptable MVP storage:

* in-memory server state
* localStorage-compatible flow
* mock session object

Do not add real Stripe keys.

Do not require external services.

The API shape should remain clean so real auth and Stripe can be added later.

---

## 21. Frontend API Client Requirements

Update the frontend API client with:

```ts
getUsageStatus()
consumeAiUsage()
getEntitlementStatus()
mockUpgradeToPro()
trackAffiliateClick()
```

These functions should call the internal API layer.

Existing build recommendation and compare flows should continue working.

If the API call fails, the UI should fail gracefully.

---

## 22. Required Monetization UI Components

Create reusable components:

```txt
UpgradeCard
ProFeatureLock
UsageBadge
AffiliateDisclosure
```

### 22.1 UpgradeCard

UpgradeCard should show:

```txt
Title: Unlock Build Pro
Price: $7.99 one-time
Bullets:
- Advanced part comparisons
- AI reasoning for every recommendation
- Purchase-ready checklist
- Better upgrade/downgrade decisions
CTA:
- Unlock Pro
```

For Milestone 6, the button should call:

```ts
mockUpgradeToPro()
```

After mock upgrade, entitlement state should update and locked UI should unlock.

### 22.2 ProFeatureLock

ProFeatureLock should show a subtle locked state for Pro-only fields.

It should include:

* Lock icon or visual lock treatment
* Short explanation
* Upgrade CTA
* No aggressive full-page blocking unless the user fully exceeds a free limit

### 22.3 UsageBadge

UsageBadge should show remaining AI usage.

Example:

```txt
3 AI questions remaining today
```

For Pro users:

```txt
Build Pro active
```

or

```txt
42 AI questions remaining for this build
```

### 22.4 AffiliateDisclosure

AffiliateDisclosure should show:

```txt
Some links may earn us a commission at no extra cost to you.
```

Use it near purchase links and purchase list areas.

---

## 23. AI Chat / Recommendation Usage Limit Rules

Wherever an AI-like question flow exists:

* Show remaining AI questions
* Consume usage when the user asks an AI-style question
* If the free limit is exceeded, show UpgradeCard
* Do not hard-crash
* Do not break existing mock recommendation behavior

If there is no real AI integration yet, implement the usage system around the existing chat/recommendation calls so it is ready for future AI API integration.

The assistant should remain usable with mock logic.

---

## 24. Affiliate Link UI Rules

Extend seed parts or part types so each part can optionally include affiliate links.

Each affiliate link can include:

* merchant
* url
* price
* inStock
* label

In the UI, add buttons such as:

```txt
Buy
View deal
Check price
```

When clicked:

1. Call `trackAffiliateClick()`
2. Open the affiliate URL

Use placeholder URLs if needed, but keep the structure realistic.

Do not claim checkout is happening inside the app.

The app should only route users to external retailers.

---

## 25. App Logic Requirements

The app should support these logic functions:

```ts
getRecommendedBuild(input)
getPartsByCategory(category)
getCompareParts(ids)
checkCompatibility(build)
replacePartInBuild(build, newPart)
getPurchaseList(build)
getCategoryComparisonFields(category)
canUseFeature(plan, featureKey)
getRemainingAiQuestions(usageStatus)
trackAffiliateClick(event)
```

If the current project already has an internal API layer, keep using it.

If not, mock API logic can remain in the frontend for MVP.

Recommended structure:

```txt
src/data/seedParts.ts
src/types/parts.ts
src/types/build.ts
src/types/monetization.ts
src/lib/build-advisor.ts
src/lib/compatibility.ts
src/lib/monetization.ts
src/lib/mockApi.ts
src/lib/apiClient.ts
src/components/build-card.tsx
src/components/compare-drawer.tsx
src/components/UpgradeCard.tsx
src/components/ProFeatureLock.tsx
src/components/UsageBadge.tsx
src/components/AffiliateDisclosure.tsx
```

Use the actual project structure if it already differs.

Do not unnecessarily rewrite the entire app.

---

## 26. Implementation Priority

Codex should implement in this order:

1. Inspect the current project structure.
2. Keep the current Lovable visual design.
3. Update copywriting from B2B2C to B2C if any old copy remains.
4. Remove or de-emphasize retail employee language.
5. Add or update TypeScript data models.
6. Add monetization types.
7. Add `src/lib/monetization.ts`.
8. Extend internal API with mock usage, entitlement, checkout, and affiliate endpoints.
9. Update frontend API client methods.
10. Add monetization UI components.
11. Expand mock seed parts data with affiliate links.
12. Make purchase buttons call affiliate click tracking.
13. Add AffiliateDisclosure near purchase links.
14. Update Compare Drawer with Free vs Pro field locking.
15. Add UsageBadge around AI-style assistant area.
16. Add usage consumption around current AI/mock recommendation flow.
17. Add UpgradeCard when usage limit is exceeded.
18. Add Pro-only purchase checklist.
19. Ensure replacing parts still updates total price.
20. Ensure replacing parts still updates compatibility warnings.
21. Ensure replacing parts still updates purchase reference list.
22. Run build and fix TypeScript or lint errors.

---

## 27. Future AI Integration

AI integration is not required for this milestone.

The app should remain AI-ready by separating:

* User requirement collection
* Build recommendation logic
* Compatibility checking
* Part replacement logic
* Monetization and entitlement logic
* UI rendering

Later, the AI layer can be added to improve:

* Requirement understanding
* Build recommendation reasoning
* Natural language explanations
* Upgrade/downgrade suggestions
* Personalized part tradeoff explanations

Do not add paid AI API requirements in this MVP milestone.

When real AI is added later, use model routing:

* Cheap model for simple requirement parsing
* Stronger model for Pro reasoning
* Rule-based compatibility checks as source of truth
* Cached price and stock data instead of live search on every user message

---

## 28. Future Stripe Integration

Do not integrate real Stripe in Milestone 6.

Milestone 6 should use:

```txt
POST /api/checkout/mock-upgrade
```

Future Stripe integration should replace mock checkout with:

* Stripe Checkout one-time payment
* Build Pro product
* Webhook for successful checkout
* Entitlement activation after successful payment
* Customer portal only if needed later

No real Stripe keys should be committed.

No payment information should be stored in the app database.

---

## 29. Safety and Scope Boundaries

Do not:

* Automatically purchase parts
* Store payment details
* Claim real-time price or stock unless it is actually fetched
* Scrape retailer websites in MVP
* Hide compatibility warnings
* Recommend incompatible parts without warning
* Expose raw token usage to users
* Add real Stripe keys
* Add hard dependency on external AI APIs for this milestone
* Break existing mock recommendation flow

MVP should use mock data only unless real APIs are intentionally added later.

---

## 30. Documentation Requirements

Create or update:

```txt
docs/MILESTONE_6_MONETIZATION.md
```

The document should include:

* What was added
* Free vs Pro feature table
* Mock checkout flow
* Future Stripe integration notes
* Affiliate disclosure note
* Token/usage control strategy
* Local testing instructions
* Remaining TODOs

---

## 31. MVP Success Criteria

The MVP is successful when:

* The app still looks like the Lovable design
* The product language feels B2C
* The build recommendation is data-driven
* The user can click a part row
* A Part Compare Drawer opens
* The drawer shows multiple same-category alternatives
* The user can select 2–4 parts for side-by-side comparison
* Free users see basic compare fields
* Free users see locked Pro fields
* Pro users can unlock advanced comparison through mock upgrade
* The user can replace a part
* Total price updates
* Compatibility warnings update
* Purchase reference list updates
* Affiliate purchase links appear
* Affiliate disclosure appears
* Affiliate clicks are tracked through mock API
* AI usage limit UI appears
* Free user AI usage is limited
* Build Pro increases usage limits
* Purchase checklist is Pro-only
* Real Stripe is not required yet
* Real AI API is not required yet
* Build passes successfully

---

## 32. Build and Testing Requirement

After implementation, run:

```bash
npm.cmd run build
```

Fix all TypeScript and build errors.

Then provide a final summary including:

* Changed files
* What was implemented
* How to test locally
* Remaining TODOs
* Whether build passed

For local preview, use:

```bash
npm.cmd run dev
```

---

## 33. Suggested Codex Prompt for This Milestone

Use this short prompt after this SKILL.md is updated:

```txt
Read docs/SKILL.md and implement Milestone 6: B2C Monetization MVP.

Create docs/MILESTONE_6_MONETIZATION.md, then implement:
- Free vs Build Pro feature access
- mock entitlement
- mock checkout upgrade
- usage limits
- UpgradeCard
- ProFeatureLock
- UsageBadge
- AffiliateDisclosure
- affiliate links on parts
- locked Pro fields in Compare Drawer
- Pro-only purchase checklist

Do not add real Stripe yet.
Do not require a real AI API yet.
Keep the existing Lovable visual style.
Run npm.cmd run build and fix all errors.

At the end, summarize changed files, local test steps, and remaining TODOs.
```
