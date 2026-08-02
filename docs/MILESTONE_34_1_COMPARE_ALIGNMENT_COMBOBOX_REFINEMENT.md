# Milestone 34.1: Compare Alignment and Searchable Select Refinement

## Goal

Refine the existing Visual Decision Workspace comparison experience without changing its product flow, replacement logic, compatibility behavior, or visual direction.

## Shared Comparison Grid

The comparison header and all data rows now use one CSS grid contract:

```css
--comparison-grid-columns:
  var(--comparison-label-width)
  repeat(3, minmax(0, 1fr));
```

The contract is shared by:

- the empty header cell above the attribute labels;
- all three product cards and search controls;
- every aligned product metric;
- whole-build total, budget, and compatibility rows;
- structured-difference and AI-recommendation rows;
- the sticky decision row.

This keeps each value directly under its product, preserves continuous vertical dividers and selected-column highlighting, and prevents long content from changing adjacent column widths. Narrow screens retain readable column widths through horizontal scrolling.

## Searchable Part Combobox

Each comparison slot now uses one accessible searchable combobox backed by the existing slot-selection handler and slot state.

Supported behavior:

- focus or click opens the complete locked-category catalog;
- typing filters by product name, manufacturer, model, category, specification, retailer, and availability;
- the results menu overlays the card instead of changing card height;
- the results list has a fixed maximum height and vertical scrolling;
- current, keyboard-active, unavailable, filtered, and no-result states are visually distinct;
- mouse selection commits the product and closes the menu;
- Arrow Up, Arrow Down, Enter, Escape, and Tab are supported;
- outside clicks close the menu and restore the selected product name;
- disabled catalog entries remain visible but cannot be selected.

The combobox query is transient UI state. Compared products remain stored only in the existing `slots` state, so build totals, compatibility impact, labels, and replacement actions continue to use one source of truth.

## Scope Boundaries

- No comparison-flow rewrite.
- No production recommendation, compatibility, replacement, or catalog service changes.
- No backend, authentication, or persistence changes.
- Existing graphite-and-green styling and category placeholders are preserved.

## Validation Checklist

- [x] Production build succeeds.
- [x] Mouse selection updates the intended comparison slot.
- [x] Keyboard selection works with Arrow keys and Enter.
- [x] Escape, Tab, and outside click close the menu correctly.
- [x] A long GPU catalog scrolls without moving card content.
- [x] Partial filters such as `4070` and `NVIDIA` return expected results.
- [x] No-result and unavailable states render correctly.
- [x] Product headers, metrics, whole-build rows, and decision rows share the same grid columns.
- [x] The selected-column highlight and vertical borders remain continuous.
- [x] Dropdown menus are not clipped.
- [x] No browser console errors occur in the exercised flow.
