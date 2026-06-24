# Milestone 8.2: AI Structured Actions and Build Needs Updates

Milestone 8.2 turns advisor output into safe, clickable action chips. The advisor can suggest next steps, but the shopper decides when to apply them.

## What Was Added

- Structured advisor actions in the AI adapter response.
- Runtime validation for suggested actions before the UI receives them.
- Chat action chips below assistant messages.
- Build Needs updates that only apply after the shopper clicks a chip.
- Workflow actions that open Part Explorer or the owned-part form.
- Response metadata for warnings, fallback behavior, and usage consumption.

## Supported Action Types

| Action | Purpose |
| --- | --- |
| `update_budget` | Updates the Build Needs budget and refreshes the rule-based recommendation. |
| `update_use_case` | Adds the accepted use case to Build Needs and refreshes the recommendation. |
| `update_appearance` | Updates the preferred build look, such as white, black, or RGB. |
| `update_brand_preference` | Updates CPU or GPU brand preference. |
| `update_experience_level` | Updates beginner, intermediate, or expert guidance level. |
| `add_owned_part` | Opens Part Explorer with the owned/custom part form ready. |
| `open_part_explorer` | Opens the relevant category in Part Explorer. |
| `explain_current_build` | Adds a local explanation message without changing the build. |
| `ask_clarifying_question` | Shows a follow-up question when more detail is needed. |

## Safety Rules

- AI suggestions never directly replace parts.
- AI suggestions never become the source of truth for compatibility.
- Compatibility, pricing, replacement limits, purchase references, and affiliate links remain rule-based.
- Sending a chat message consumes AI usage.
- Clicking an action chip does not consume AI usage unless it sends another advisor request.
- Build Needs and the build recommendation change only after the shopper clicks an action chip.

## How Build Needs Update

Accepted chips merge into the current Build Needs state:

- Budget updates the target budget.
- Use case merges with existing use cases.
- Appearance updates the visual preference.
- Brand preference updates only the CPU or GPU brand named by the action.
- Experience level updates the guidance level.

Updated cards show a small "Updated" marker so shoppers can see what came from an accepted advisor action.

## How Owned Part Actions Work

When the advisor detects messages like "I already have an SSD" or "I own a GPU," it returns an `add_owned_part` action.

Clicking that chip opens the Part Explorer search tab with the owned-part form expanded. The shopper can then add a local mock part. Owned parts still count as `$0` and still participate in rule-based compatibility checks.

## Mock Provider Examples

- "budget 2500" returns `update_budget`.
- "white build" returns `update_appearance`.
- "I prefer NVIDIA" returns `update_brand_preference`.
- "I already have SSD/PSU/GPU" returns `add_owned_part`.
- "should I upgrade GPU or CPU" returns `open_part_explorer`.
- "for 1440p gaming" returns `update_use_case`.

## Future TODOs

- Add stricter provider-specific JSON schema enforcement.
- Persist accepted action history with real accounts.
- Add undo for accepted Build Needs chips.
- Add richer action previews before refreshing a build.
- Extend owned-part actions with more detailed spec extraction.
- Add analytics for which safe actions shoppers accept.
