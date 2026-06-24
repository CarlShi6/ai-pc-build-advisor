# Milestone 8.3: Saved Builds and Export Flow

Milestone 8.3 adds build planning continuity: shoppers can save build snapshots, reopen them, and prepare export-ready purchase references.

## Saved Build Behavior

Saved builds include:

- Saved build id and name
- Full current build
- Current Build Needs
- Created and updated timestamps
- Total estimated price
- Compatibility status
- Owned parts count
- Target use case
- Main CPU and GPU summary for cards

The consult page has a Save Build control near the purchase references. The Saved Builds top-nav action opens a side panel with saved build cards.

Each saved build card supports:

- Load build
- Rename
- Delete

Loading a build restores the saved parts, Build Needs, compatibility state, and purchase references through the existing rule-based preview flow.

## Save Limits

| Plan | Saved build limit |
| --- | --- |
| Free | 1 saved build |
| Build Pro | 10 saved builds |

If a Free user tries to save beyond the limit, the API returns a friendly limit error and the UI shows an upgrade prompt. Updating or renaming an existing saved build does not count as an additional save.

## Export Behavior

Everyone can preview the export text. Build Pro unlocks full export actions:

- Copy build summary to clipboard
- Download JSON
- Download Markdown

The export includes the build summary, Build Needs, selected parts, owned-part pricing, purchase references, and affiliate disclosure.

## Free vs Pro Rules

Free users can:

- Save 1 build locally in the mock session
- Preview the export text
- Continue using basic purchase references

Build Pro users can:

- Save up to 10 builds
- Export the full purchase reference list
- Copy or download export-ready build plans

No Stripe is added in this milestone. Build Pro remains the existing mock entitlement.

## Mock Persistence Notes

Saved builds use the internal mock API state for this milestone. This keeps the feature self-contained and avoids external services.

Current limitations:

- Saved builds reset when the mock server/session resets.
- Saves are scoped to the temporary mock user.
- There is no account sync or cross-device persistence yet.

## Future Auth and Database Notes

Future production work should move saved builds to authenticated persistence:

- Add real user accounts.
- Store saved builds in a database keyed by user id.
- Persist accepted Build Needs and owned-part metadata.
- Add optimistic updates and undo for deletes.
- Add export history if shoppers need repeat downloads.
- Keep compatibility, pricing, owned parts, replacement limits, and purchase references rule-based.
