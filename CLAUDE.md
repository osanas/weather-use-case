# Working in Weather Window

Read [the product specification](docs/product-spec.md) and [the deployment specification](docs/deployment.md) before planning changes. The product spec owns expected behavior. Check implementation status before assuming a command or feature already exists.

## Workflow

- Start from an issue or a specific acceptance criterion. For changes across modules, new data flows or production settings, inspect the repo in Plan Mode and propose scope, interface changes, failure cases and verification before implementation.
- Keep one coherent change per branch. Reuse existing contracts and avoid unrelated changes. Surface product, privacy or deployment tradeoffs with the PR.
- Use a separate review session with read-only tools for security-sensitive or cross-module diffs. Review against the acceptance criteria and cite files and lines. Record reviewed fixes in the PR.
- Report exact checks run, their outcomes and any remaining manual verification. GitHub CI and the maintainer verify release readiness. Leave pushing, merging, credential changes and production releases to the maintainer unless explicitly authorized.
- If several people or sessions work concurrently, agree shared contracts first and use independent branches or worktrees with separate test data.

## Git workflow

- Before editing files or committing, run `git status -sb` and `git branch --show-current`.
- Never commit directly on `main`.
- If the task has a ticket, create or switch to its feature branch first
  (for example, `feat/WEA-13-planning-guide`).
- Create feature branches without tracking `origin/main` (`git switch -c <branch> --no-track origin/main`), and check that `git status -sb` never shows `...origin/main` on a feature branch. A feature branch that tracks `origin/main` pushes its commits straight to `main`.
- Before every commit, verify that the current branch is not `main`.
- Do not push or merge unless explicitly asked.
- If the working tree contains changes from another task, stop and report them; do not move or commit them.

## Implementation boundaries

- Keep provider calls and credentials server-side. Never read, print, commit or request real secrets in AI sessions. Use placeholders and synthetic fixtures. Keep user data, private provider logs and confidential assessment evidence out of prompts, tests and Git history.
- City search is local. Resolve incoming city IDs from the public catalogue. Forward only the approved structured fields and public forecast data defined in the spec. Keep identities, precise visitor locations, free text, client IPs and browser headers out of weather and AI payloads.
- Validate client inputs and model tool arguments before execution. Use a fixed list of read-only tools with fixed outbound provider destinations. Keep recommendation calculations in the deterministic planner. Treat model responses and provider output as untrusted.
- Keep AI failures isolated from weather. Keep request budgets finite. Use allowlisted operational log fields and safe error messages. For changes to providers, logging, tracking, retention or feature flags, update the deployment spec and flag the privacy impact for review.
- Apply tool permissions and hosting or repository settings to enforce boundaries. These project instructions describe the workflow.

## Verification

Run the applicable repository commands once configured.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Use fixed clocks and fixtures for planner tests. Cover time zones, boundary values, missing data, invalid tool calls and supplier failures in the affected modules. CI tests should run without live provider keys. Link relevant evidence to the acceptance criterion in the PR.

## Linear, pull requests and browser tests

Use the issue ID in the branch and PR title. Include the acceptance criterion, preview and test evidence in the PR template. Follow [the team workflow](docs/team-workflow.md) for the Playwright contract. Run npm run build followed by npm run test:e2e for UI changes. Use synthetic data in issues, reviews, CI and test artifacts.
