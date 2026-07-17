# Milestone 33: Visual System Upgrade

## Goal

Move AI PC Build Advisor from a blue-heavy MVP appearance to a cleaner, premium Professional Gaming Configurator visual system. The upgrade improves the product's visual language, hierarchy, and consistency without changing recommendation, compare, replacement, persistence, or shopping-list behavior.

## Visual Direction

The interface uses a dark graphite foundation with crisp white typography, neutral elevated surfaces, restrained green accents, and a very subtle cool technical highlight. The intended character is professional software first and gaming hardware second: precise, premium, and approachable rather than neon, decorative, or arcade-like.

The direction takes cues from the clarity and restraint of modern developer tools while using green to suggest hardware compatibility, recommended choices, and decisive actions.

## Design Principles

- **Neutral foundation:** Near-black, graphite, and slate carry the layout so content remains the focus.
- **Green with purpose:** Green identifies primary actions, recommendations, compatibility success, and positive value or budget outcomes.
- **Quiet secondary controls:** Secondary, outline, navigation, and utility actions use neutral surfaces and borders.
- **Layered, not glossy:** Subtle elevation, low-contrast borders, and restrained gradients separate surfaces without excessive glow.
- **Decision hierarchy:** Recommended builds, Quick Verdict, compare outcomes, and purchase references receive the strongest hierarchy.
- **Readable density:** Consistent radii, more deliberate spacing, stronger field treatment, and calmer supporting text make technical information easier to scan.
- **Responsive continuity:** Existing grid, overflow, wrapping, and breakpoint behavior is preserved.

## Color System

The semantic palette is defined in `src/styles.css` with OKLCH CSS variables and exposed through the existing Tailwind v4 theme mapping.

- **Background:** Near-black neutral with extremely subtle green and muted-cyan ambient light.
- **Card and elevated surfaces:** Graphite layers with neutral borders.
- **Primary:** Green based on the visual role of `#22C55E`.
- **Primary glow:** A lighter green used only for hover and restrained action elevation.
- **Success:** Green for compatibility, recommended fit, and positive outcomes.
- **Technical accent:** Muted cyan reserved for quiet ambient depth rather than primary controls.
- **Warning:** Amber.
- **Destructive:** Red.
- **Text:** High-contrast neutral foreground with a softer slate-gray secondary tone.

The previous cobalt primary, ring, sidebar, and chart emphasis has been replaced with green or neutral equivalents. The optional `.dark` selector now inherits the same deliberate root palette instead of introducing a second blue-heavy theme.

## Component Treatment

### Cards and surfaces

Shared cards use a larger consistent radius, neutral border, translucent graphite surface, and low-key elevation. Reusable `surface-panel` and `surface-inset` patterns provide consistent outer and nested treatments across feature components.

### Buttons

Primary buttons use green with a dark foreground for clear contrast. Glow is restrained to hover or important actions. Secondary and outline buttons use neutral graphite surfaces and borders. Focus rings, disabled states, and active feedback remain visible.

### Badges and status

Default badges use a green tint rather than a solid colored block. Secondary badges are neutral. Success, warning, and destructive states retain semantic green, amber, and red treatments.

### Navigation

The top mode selector is a neutral segmented control. The active route uses a green-tinted state rather than a large solid-color pill, reducing color competition with primary actions.

### Chat and prompts

The assistant panel uses a layered graphite surface, a quieter header, elevated assistant messages, clearer starter-prompt cards, and a stronger inset input. The send control remains a green primary action.

### Build and shopping surfaces

The build card uses consistent surface elevation, quieter table headers and row hover states, green totals and status signals, and a restrained Build Insight panel. Shopping-list and purchase-reference areas use the same surface hierarchy so purchase planning reads as a distinct workflow rather than an extension of the page background.

### Compare drawer

The compare drawer uses a neutral elevated shell and header. Selected tabs use a green-tinted state, Quick Verdict receives the strongest recommended treatment, the current option stays neutral, and the leading alternative uses green. Tradeoff and swap sections use shared surface treatments to reduce visual noise while preserving decision clarity.

## What Changed

- Replaced the blue-heavy semantic token set with graphite neutrals and a green primary system.
- Added shared card, elevated-surface, inset-surface, glow, and ambient-shell tokens.
- Updated shared button, badge, and card primitives.
- Polished the top navigation and active-route treatment.
- Refined the consult page background, spacing, build-needs area, and recommendation summary.
- Refined chat messages, starter prompts, composer, and send action.
- Refined the build card, component table, status treatment, insight panel, and embedded shopping list.
- Refined the compare drawer shell, tabs, Quick Verdict, decision summary, tradeoffs, preview, and compare tray.
- Refined the purchase-reference page and checklist surfaces.

No provider logic, APIs, persistence, database schema, authentication, recommendation logic, compare behavior, swap behavior, or shopping-list behavior changed.

## Known Limitations

- The milestone keeps the existing dark application direction; a full light theme is not included.
- Some older routes and low-frequency dialogs continue to rely primarily on global tokens rather than bespoke surface polish.
- Dense tables still use horizontal scrolling on narrow screens by design.
- The current brand mark and product naming are unchanged.
- Motion remains limited to existing transitions and loading states.
- Product imagery and a dedicated hardware illustration system are outside this milestone.

## Future Visual Improvements

- Add a fully designed light professional theme using the same semantic tokens.
- Create formal typography and density scales for data-heavy and presentation-oriented views.
- Add visual regression snapshots for core desktop and mobile states.
- Improve narrow-screen table alternatives with stacked decision rows where appropriate.
- Extend the surface system to remaining account, upgrade, error, and checkout-adjacent screens.
- Develop a restrained hardware iconography and product-imagery system.
- Add motion guidelines for compare transitions, recommendation changes, and successful swaps.
