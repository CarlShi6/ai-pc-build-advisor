# Milestone 38: Guided Decision UX and Demo Readiness

## UX problems addressed

The comparison drawer exposed verdict reasoning, two full decision cards, price metrics, a chart, observations, alternatives, and swap controls at once. This milestone reduces that initial density while preserving configuration context, comparison, and the independently scrollable AI consultation.

## Information hierarchy

Quick Verdict remains first. Its recommended part and Preview swap action are visually dominant. A compact Decision Summary follows, then the current selection and exact-part price history. Recommended and searched alternatives remain available before the user opts into deeper analysis.

The sticky header keeps the category, build total, modes, sorting, and a bordered close control in less vertical space. The alternative count appears once beside the category focus.

## Progressive disclosure decisions

Quick Verdict reasoning, current-versus-alternative decision cards, the successful price chart, and observation records are collapsed by default. Compact recommendation, price delta, compatibility status, range controls, source disclosure, and price summary remain visible. Native `details` and `summary` controls retain keyboard operation and expanded/collapsed semantics without custom state.

## Action hierarchy

Preview swap is the primary action on recommendation and catalog cards. Compare/Add to compare is secondary. Product details is tertiary. Applying a replacement remains available in the existing confirmation preview, where it is the final committed action. The recommended-swap panel no longer presents Preview and Apply as competing green buttons.

## Price-history empty-state decision

No-data, unknown-part, and error states use only the space their messages and retry action need. They do not reserve the successful chart area. Loading remains compact and announced. Successful results retain 7D/30D/90D controls, exact canonical identity, the visible non-live disclosure, summary metrics, a disclosed chart, and disclosed observation details.

## Demo-data alignment

The `$1500 gaming PC for 1080p/1440p` Demo Starter deterministically selects `cpu-i7-14700k`, which has its own Milestone 36 sample observations. A focused test protects this exact identity. No observation is borrowed across parts and the UI does not claim wider catalog coverage.

## Responsive behavior

The drawer uses wrapping, `min-w-0`, independent vertical scrolling, compact sticky controls, and local table overflow. Primary actions remain before secondary actions in narrow layouts. The intended manual viewport checks are 1280px, 1024px, and approximately 390px, including document overflow, long names, chat/drawer scrolling, and tray clearance.

## Accessibility

Disclosure controls are native keyboard-accessible summaries with visible focus rings. Section headings remain semantic. Range buttons retain accessible labels and pressed state. Loading remains polite, errors remain alerts, retry remains keyboard accessible, and price charts retain text equivalents.

## Tests

Focused coverage includes compact price no-data rendering, collapsed successful price detail, accessible disclosure labels, range controls, exact-part request switching, stale response protection, retry, non-live disclosure, and a Demo Starter backed by exact deterministic sample observations. Existing comparison and replacement tests remain unchanged.

## Manual QA

Check Recommended and Search modes, selection of 2–4 comparison items, Compare, Preview swap, Apply swap, supported and unsupported price-history parts, all ranges, chat input while comparison is open, independent scrolling, keyboard focus, and widths of 1280px, 1024px, and about 390px.

## Known limitations

Price history remains sparse deterministic development data. It is not live pricing and does not represent broad catalog coverage. Native disclosures intentionally favor reliability and accessibility over animated transitions. Mobile retains the three product areas sequentially rather than simultaneously.

## Rollback notes

Revert the Milestone 38 commit to restore the previous expanded hierarchy and action styling. No route, generated route tree, environment file, dependency, schema, service, or external data requires cleanup.
