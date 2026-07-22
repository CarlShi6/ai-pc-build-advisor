# Milestone 35: CI and Release Gates

## Goal

Add a small, reproducible GitHub Actions workflow that validates changes before they reach `main`. This milestone adds validation only; it does not deploy the application.

## Workflow triggers

The `CI` workflow runs for pull requests targeting `main` and pushes to `main`. Other branches are validated when they open or update a pull request to `main`.

## Node version decision

CI uses Node.js 22. The repository does not contain an `.nvmrc`, `.node-version`, or `package.json` `engines` declaration. Node 22 matches the project's `@types/node` major version and satisfies the modern Node requirements of the Vite 7 toolchain without introducing a version matrix.

## Dependency installation

Dependencies are installed with `npm ci`, using the committed `package-lock.json`. `actions/setup-node` provides npm's dependency cache keyed from that lockfile. Build output, environment files, and secrets are not cached.

## Required CI checks

The `Validate` job has required, failure-producing steps for:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `git diff --check`

Commands are separate, descriptively named steps so a failure is visible without searching a combined log. The job has a 20-minute timeout.

## Linting decision

Repository-wide lint is advisory for this milestone. The existing ESLint configuration runs Prettier as an ESLint rule, and untouched files contain known formatting debt. CI runs `npm run lint -- --rule "prettier/prettier: off"` with `continue-on-error` so semantic findings remain visible without blocking unrelated work. At milestone creation, this command still reports a pre-existing `@typescript-eslint/no-empty-object-type` error and several warnings. Full lint must not become required until that existing debt is addressed deliberately.

## Permissions

The workflow explicitly grants only `contents: read`. It does not request write access, use repository secrets, or add credentials for pull requests.

## Concurrency behavior

The concurrency group combines the workflow name with the pull request number when available, otherwise the Git ref. `cancel-in-progress: true` cancels an obsolete run when a newer commit is pushed to the same pull request or branch.

## Local equivalents

On Windows, run:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run lint -- --rule "prettier/prettier: off"
git diff --check
```

On Unix-like systems, use `npm` instead of `npm.cmd`.

## Interpreting failed checks

- **Install dependencies:** the lockfile and `package.json` may disagree, or the npm registry may be unavailable.
- **Check types:** inspect TypeScript diagnostics and fix the referenced source types.
- **Run tests:** inspect the failing Vitest suite and assertion output.
- **Build production bundle:** inspect Vite or Nitro output for compilation or production-bundling failures.
- **Check whitespace errors:** remove trailing whitespace or correct conflict markers reported by Git.
- **Run semantic lint (advisory):** review the ESLint output, but recognize that its failure does not fail the `Validate` job during this milestone.

## Known limitations

CI validates one supported Node release and does not provide cross-version or cross-platform coverage. Lint is advisory because of existing semantic and formatting debt. The workflow validates the production build but does not exercise a deployed environment or configure branch-protection rules; repository administrators should make the `Validate` check required in GitHub settings if it is to be enforced as a merge gate.

## Deferred automation and functionality

Cloudflare deployment automation, tokens, and secrets are intentionally deferred. Existing Cloudflare configuration is unchanged. Price-history functionality is also explicitly deferred and is not part of this milestone.

## Rollback notes

To roll back this milestone, revert the milestone commit. That removes `.github/workflows/ci.yml` and this document without touching application code, Cloudflare configuration, environment files, deployment state, or generated route-tree content. If branch protection is configured to require the `Validate` check, update that rule before removing the workflow so pull requests are not left waiting for a check that can no longer run.
