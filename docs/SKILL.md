# AI装机助手 / AI PC Build Advisor Skill

Version: 4.0.0
Project Type: B2B2C Full-Stack MVP
Frontend Source: Lovable exported React/Vite project
Implementation Agent: Codex

## 1. Product Goal

AI装机助手 / AI PC Build Advisor is a B2B2C web app for retail store employees and beginner customers.

The product helps users:

* Collect PC build needs through AI chat
* Generate a recommended PC build
* Compare PC components
* Replace parts
* Check compatibility
* Generate a pre-cart purchase list
* Provide a short store employee sales summary

This project currently has a Lovable-generated frontend. The frontend is mostly static and should be upgraded into a real interactive MVP.

## 2. Target Users

### Retail Store Employees

They need to quickly help customers configure PCs, explain part differences, compare alternatives, and create a purchase-ready list.

### Beginner Customers

They need simple explanations, clear recommendations, compatibility warnings, and easy comparison between parts.

## 3. Core Layout

The app should keep the current Lovable visual design.

Core layout:

* Left side: AI chat assistant
* Right side: live PC build recommendation card
* Configuration list inside the recommendation card
* Component comparison drawer or modal
* Pre-cart purchase list
* Store employee summary panel

## 4. MVP Features

### 4.1 AI Chat Assistant

The chat assistant should collect:

* Budget
* Use case
* Gaming resolution
* Productivity workload
* Appearance preference
* Platform or brand preference
* Existing parts
* Technical familiarity

For MVP, the chat can use mock logic and does not need a real LLM connection yet.

### 4.2 Live Build Recommendation

The build card should show:

* Build name
* Total estimated price
* CPU
* GPU
* Motherboard
* RAM
* SSD
* PSU
* Case
* Cooler
* Compatibility status

### 4.3 Component Compare

When the user clicks a component row, such as GPU or CPU, open a compare drawer.

The compare drawer should show:

* Current selected part
* Alternative parts
* Price
* Specs
* Performance fit
* Compatibility notes
* Power requirement
* Recommendation reason
* Replace button

When a part is replaced:

* Build total price updates
* Compatibility warnings update
* Pre-cart list updates
* Employee summary updates

### 4.4 Compatibility Check

MVP compatibility rules should check:

* CPU socket vs motherboard socket
* Motherboard RAM type vs RAM type
* PSU wattage vs estimated system wattage
* GPU length vs case clearance
* Case form factor vs motherboard form factor
* Cooler height/radiator fit vs case clearance

### 4.5 Pre-Cart List

The app should generate a pre-cart list with:

* Part name
* Retailer
* Estimated price
* Product URL or search URL
* Quantity
* Availability status
* Note

The app must not perform real checkout or payment.

### 4.6 Store Employee Summary

Generate a short summary for store employees:

* Customer goal
* Recommended build logic
* Key selling points
* Cheaper alternative
* Upsell option
* Compatibility status
* Pre-cart status

## 5. Data Models

Use TypeScript types.

### Part

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

### CartPreviewItem

```ts
export interface CartPreviewItem {
  partId: string;
  displayName: string;
  retailer: string;
  estimatedPrice: number;
  quantity: number;
  productUrl?: string;
  searchUrl?: string;
  note?: string;
}
```

## 6. API Requirements

Because this is currently a Vite React project, implement mock API logic in the frontend first if adding a separate backend is too large.

Preferred MVP structure:

```txt
src/data/seedParts.ts
src/types/parts.ts
src/types/build.ts
src/lib/mockApi.ts
src/lib/compatibility.ts
```

Mock API functions:

```ts
getRecommendedBuild(input)
getPartsByCategory(category)
getCompareParts(ids)
checkCompatibility(build)
getCartPreview(build)
```

Later backend endpoints can be:

```txt
GET /api/parts?category=gpu
GET /api/parts/compare?ids=...
POST /api/build/recommend
POST /api/build/compatibility-check
GET /api/offers?partId=...
POST /api/cart/preview
```

## 7. Implementation Priority

Codex should implement in this order:

1. Inspect the current Lovable project structure.
2. Keep the current visual design.
3. Refactor static UI into reusable components where useful.
4. Add TypeScript data models.
5. Add mock seed parts data.
6. Add mock API functions.
7. Make the configuration list render from data instead of hard-coded text.
8. Add click interaction on component rows.
9. Add component compare drawer/modal.
10. Allow replacing selected part.
11. Update total price after replacement.
12. Run compatibility check after replacement.
13. Update pre-cart list.
14. Update employee summary.
15. Keep real checkout/payment out of scope.

## 8. Safety and Scope Boundaries

Do not:

* Automatically purchase parts
* Store payment details
* Claim real-time price or stock unless it is actually fetched
* Scrape retailer websites in MVP
* Hide compatibility warnings

MVP should use mock data only.

## 9. MVP Success Criteria

The MVP is successful when:

* The app still looks like the Lovable design
* The build recommendation is data-driven
* The user can click a part
* A compare drawer/modal opens
* Alternatives are shown
* The user can replace a part
* Total price updates
* Compatibility warnings update
* Pre-cart list updates
* Employee summary updates
