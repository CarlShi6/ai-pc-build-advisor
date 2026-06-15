# AI装机助手 / AI PC Build Advisor Skill

Version: 5.0.0
Project Type: B2C Full-Stack MVP
Frontend Source: Lovable exported React project, now upgraded in local GitHub repo
Implementation Agent: Codex

## 1. Product Goal

AI装机助手 / AI PC Build Advisor is now a B2C web app for regular PC buyers.

The product helps beginner and intermediate users configure a custom PC by understanding their budget, use case, performance needs, appearance preferences, and technical comfort level.

The app should help users:

* Collect PC build needs through a guided chat or form-like assistant
* Generate a recommended PC build
* Understand why each part was selected
* Compare multiple PC components in the same category
* Replace parts and immediately see price and compatibility changes
* Check compatibility risks
* Generate a purchase reference list

This project should no longer prioritize retail employee workflows, in-store sales scripts, or B2B sales summaries.

## 2. Target Users

### Beginner PC Buyers

Users who want to build or buy a PC but do not fully understand PC parts.

They need:

* Simple explanations
* Clear recommendations
* Budget control
* Compatibility warnings
* Easy part comparison
* Confidence before buying

### Intermediate PC Buyers

Users who know some PC hardware but still want help comparing options.

They need:

* More part alternatives
* Side-by-side specs
* Performance and value tradeoffs
* Upgrade and downgrade options
* Compatibility checks

## 3. Core Layout

The app should keep the current Lovable visual style and main layout.

Core layout:

* Left side: AI-style build assistant or guided requirement panel
* Right side: live PC build recommendation card
* Configuration list inside the recommendation card
* Clickable component rows
* Part comparison drawer or modal
* Purchase reference list
* Compatibility summary

The UI should feel consumer-facing, not store-employee-facing.

## 4. MVP Features

### 4.1 Build Assistant

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

### 4.2 Live Build Recommendation

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

### 4.3 Part Compare Drawer

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

### 4.4 Category-Specific Comparison Fields

The comparison drawer should use category-specific specs.

CPU comparison should include:

* Cores
* Threads
* Socket
* Gaming score
* Productivity score
* Power draw
* Price
* Recommendation reason

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

Motherboard comparison should include:

* Socket
* Chipset
* Form factor
* Wi-Fi support
* PCIe support
* Memory support
* Price

RAM comparison should include:

* Capacity
* DDR type
* Speed
* Latency
* Color
* Price

SSD comparison should include:

* Capacity
* Interface
* Read speed
* Write speed
* Price

PSU comparison should include:

* Wattage
* Efficiency rating
* Modularity
* Native 12VHPWR or 12V-2x6 support
* Price

Case comparison should include:

* Form factor support
* GPU clearance
* Radiator support
* Color
* Price

Cooler comparison should include:

* Cooler type
* Air cooler height or radiator size
* Socket support
* Noise level
* Price

### 4.5 Compatibility Check

MVP compatibility rules should check:

* CPU socket vs motherboard socket
* Motherboard RAM type vs RAM type
* PSU wattage vs estimated system wattage
* GPU length vs case clearance
* Case form factor vs motherboard form factor
* Cooler height or radiator fit vs case clearance
* PSU connector support for modern GPUs

Compatibility warnings should never be hidden.

### 4.6 Purchase Reference List

The app should generate a purchase reference list with:

* Part name
* Retailer
* Estimated price
* Product URL or search URL
* Quantity
* Availability status
* Note

The app must not perform real checkout or payment.

The MVP can use mock retailer data and search URLs. It should not claim real-time pricing or stock unless real data is actually fetched.

## 5. Data Models

Use TypeScript types.

### PartCategory

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

### Part

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

### Build

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

### CompatibilityWarning

```ts
export interface CompatibilityWarning {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  affectedPartIds: string[];
  suggestedFix?: string;
}
```

### PurchaseListItem

```ts
export interface PurchaseListItem {
  partId: string;
  displayName: string;
  retailer: string;
  estimatedPrice: number;
  quantity: number;
  productUrl?: string;
  searchUrl?: string;
  availability?: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  note?: string;
}
```

## 6. App Logic Requirements

The app should support these logic functions:

```ts
getRecommendedBuild(input)
getPartsByCategory(category)
getCompareParts(ids)
checkCompatibility(build)
replacePartInBuild(build, newPart)
getPurchaseList(build)
getCategoryComparisonFields(category)
```

If the current project already has an internal API layer, keep using it. If not, mock API logic can remain in the frontend for MVP.

Recommended structure:

```txt
src/data/seedParts.ts
src/types/parts.ts
src/types/build.ts
src/lib/build-advisor.ts
src/lib/compatibility.ts
src/lib/mockApi.ts
src/components/build-card.tsx
src/components/compare-drawer.tsx
```

## 7. Implementation Priority

Codex should implement in this order:

1. Inspect the current project structure.
2. Keep the current Lovable visual design.
3. Update copywriting from B2B2C to B2C.
4. Remove or de-emphasize retail employee language.
5. Add or update TypeScript data models.
6. Expand mock seed parts data.
7. Make the configuration list render from data.
8. Make component rows clickable.
9. Upgrade the swap drawer into a richer Part Compare Drawer.
10. Allow selecting multiple same-category parts for comparison.
11. Add category-specific comparison tables.
12. Allow replacing the selected part.
13. Update total price after replacement.
14. Run compatibility check after replacement.
15. Update purchase reference list after replacement.
16. Keep AI integration as a future placeholder.
17. Run build and fix any TypeScript or lint errors.

## 8. Future AI Integration

AI integration is not required for this milestone.

The app should remain AI-ready by separating:

* User requirement collection
* Build recommendation logic
* Compatibility checking
* Part replacement logic
* UI rendering

Later, the AI layer can be added to improve:

* Requirement understanding
* Build recommendation reasoning
* Natural language explanations
* Upgrade/downgrade suggestions
* Personalized part tradeoff explanations

Do not add paid AI API requirements in this MVP milestone.

## 9. Safety and Scope Boundaries

Do not:

* Automatically purchase parts
* Store payment details
* Claim real-time price or stock unless it is actually fetched
* Scrape retailer websites in MVP
* Hide compatibility warnings
* Recommend incompatible parts without warning

MVP should use mock data only unless real APIs are intentionally added later.

## 10. MVP Success Criteria

The MVP is successful when:

* The app still looks like the Lovable design
* The product language feels B2C
* The build recommendation is data-driven
* The user can click a part row
* A Part Compare Drawer opens
* The drawer shows multiple same-category alternatives
* The user can select 2–4 parts for side-by-side comparison
* The user can replace a part
* Total price updates
* Compatibility warnings update
* Purchase reference list updates
* AI integration is not required yet
