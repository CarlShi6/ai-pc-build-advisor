# Milestone 24: Non-Blocking AI-Assisted Compare UI

## UX Decision

Part comparison now opens as an inline docked compare panel inside the consultation page instead of a blocking drawer. The AI chat remains visible and usable while the user reviews replacement parts, searches alternatives, previews swaps, and applies a replacement.

On desktop, the page can show the current build workspace, the compare panel, and the AI consultation assistant at the same time. On small screens, the layout stacks the chat first, then the compare panel, then the rest of the build details, so the conversation remains the primary interaction surface.

The compare panel does not dim the page, portal out of the layout, trap focus, or block scrolling and typing in the chat input. It has a small close button and behaves like a normal page panel.

## Why This Strengthens The Moat

The product should not feel like a static PC parts table with an AI chat bolted on. Keeping chat and comparison open together makes the advisor feel present during the decision. Users can ask follow-up questions while looking at the selected part, candidate replacements, current build total, and budget context.

Advisor requests now include the active compare context when a compare panel is open. That gives the AI enough local state to discuss the current part and alternatives in future messages without requiring the user to restate what they are comparing.

## Implementation Notes

- `CompareDrawer` was converted to an inline `ComparePanel` while preserving the existing replacement, search, preview, and comparison logic.
- The consult page layout conditionally adds a docked compare column when comparison is active.
- The AI chat column remains mounted and interactive while compare is open.
- Active compare context includes the category, selected part, candidate parts, current build total, and budget.
- Both the mock advisor and OpenAI prompt path can reference the active compare context.
