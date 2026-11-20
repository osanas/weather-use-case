# Team workflow

## Bootstrap the repository

Copy the kit into the Next.js repository root. Merge existing configuration before replacing it. The supplied .nvmrc targets Node 24. Choose the same supported Node major in CI, local development and Vercel. After scaffolding the Next.js TypeScript application, install the browser test runner and define its npm script:

```bash
npm install --save-dev @playwright/test
npm pkg set 'scripts.test:e2e=playwright test'
npx playwright install chromium
npm run build
npm run test:e2e
```

Commit package.json and package-lock.json together. CI expects working lint, typecheck, test, build and start scripts. Use ESLint for lint, tsc --noEmit for typecheck, a non-watch unit runner for test, next build for build and next start for start. Configure the unit runner to include unit and integration suites only, excluding tests/e2e. Ignore test-results/ and playwright-report/ in Git. CI runs on Linux and installs Chromium's system dependencies.

## Connect the services

1. In Linear, create a Weather Window project and the tickets below. In workspace settings, connect the GitHub integration and grant repository access for this project. Use the real Linear issue ID in the branch name and PR title. Link an issue to a test PR and inspect the link from both services. Keep the requirement and outcome in the PR so reviewers can follow it without Linear access.
2. Push the workflow and open a PR. In GitHub Actions, confirm that Verify runs for the PR. After the first successful run, configure the main branch rule to require a PR and the Verify status check where available. For solo delivery, allow the maintainer to merge after checks pass. With a team, add human review.
3. In Vercel, import the repository as Next.js and set main as the production branch. Enable Git previews for feature branches. Set AI_ENABLED=false in Preview by default. Keep production provider keys in the production environment. Open the PR preview to verify the UI before merging. Configure production according to the deployment specification, then verify a live provider call and the deployed SHA.
4. Test the full workflow with one real change. Confirm the Linear link, GitHub check, Vercel preview and production release record. GitHub and Vercel connect through their Git integration. The CI workflow requires no deployment token.

## Initial Linear backlog

| Ticket title | Acceptance or evidence |
|---|---|
| Bootstrap CI and deploy a vertical slice | A public page displays a real Laval forecast. Record URL and commit. |
| Implement city search and forecast views | WX-01 through WX-03, including missing readings and time zones. |
| Rank eligible activity windows | AG-01 and AG-02, including a two-hour window whose second hour fails. |
| Integrate the weather agent and fallback | AG-03 and AG-04, including a fake model timeout at the server boundary. |
| Verify the public interface | Browser suite and manual keyboard/mobile preview checks pass. |
| Harden and release the demo | SEC-01, SEC-02 and PRIV-01. Verify limits, public access, provider settings and release SHA. |

## Browser-test contract

The included suite specifies the proposed English accessible labels, the request fields and example response shapes for the initial implementation. Use a searchable city combobox, an activity select, a date input, a duration input and a named result region. Thresholds come from the server-side policy, so the form has no threshold inputs; responses echo the effective criteria. The test uses a fixed Toronto clock and intercepts browser calls to the two same-origin API routes. Implement the page to fetch these routes for this journey. Keep contracts aligned when field names or controls change.

The two browser cases verify request construction, local-time display and the visible AI-assisted or rule-based mode. Both use synthetic responses. Add a separate planner unit test that supplies winds of 15 and 30 km/h and rejects that two-hour period for a 25 km/h maximum. Add a server integration test that simulates a model timeout and checks that the real handler produces the rule-based result. The production smoke test exercises the actual providers.

References: [Linear GitHub integration](https://linear.app/docs/github-integration), [Playwright CI](https://playwright.dev/docs/ci-intro), [Vercel environments](https://vercel.com/docs/deployments/environments).
