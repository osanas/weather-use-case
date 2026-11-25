# Weather Window | Deployment specification

Status — proposed procedure. Complete the production record with verified settings and results before submission.

## Environments and configuration

Import the Git repository into Vercel as a Next.js project. Use `main` as the production branch. Use Preview deployments for pull requests. Require CI status checks before merging where repository settings support it. Protect preview access where available and keep the final production URL public. Leave source and build logs protected. Match the Node.js version in development, CI and Vercel.

| Variable | Configuration |
|---|---|
| `AI_ENABLED` | Defaults to `false`. Enable in production after validating the provider configuration and request path. |
| `AI_PROVIDER` | Optional, `gemini` or `groq`. Selects the only AI provider the deployment calls. When unset, Gemini is used if both `GEMINI_*` values are set, otherwise Groq. Any other value disables the agent. Set it explicitly in production and record it in the release record. |
| `GEMINI_API_KEY` | Server-only Gemini API credential. Use a separate key per environment that calls the model. Keep disabled previews keyless. |
| `GEMINI_MODEL` | A specific Gemini model identifier verified to support function calling through the OpenAI-compatible endpoint. Record the tested identifier in the release record. |
| `GROQ_API_KEY` | Server-only GroqCloud credential from `console.groq.com` (keys start with `gsk_`). Groq is not xAI Grok: an xAI key is rejected with `401 invalid_api_key`, logged as `model_http_error`. Use a separate key per environment that calls the model. Keep disabled previews keyless. |
| `GROQ_MODEL` | A specific Groq model identifier verified to support local tool calling. Record the tested identifier in the release record. |

### Where to set each value

| Variable | Local | Vercel Preview | Vercel Production | GitHub |
|---|---|---|---|---|
| `AI_ENABLED` | `.env.local` | `false` by default | `true` after validation | `false` in CI |
| `AI_PROVIDER` | `.env.local` (optional) | With the key | `gemini` or `groq` | Never |
| `GEMINI_API_KEY` | `.env.local` | Only for an AI-enabled preview, with its own key | Production key if Gemini is selected | Never |
| `GEMINI_MODEL` | `.env.local` | With the key | Tested model id | Never |
| `GROQ_API_KEY` | `.env.local` | Only for an AI-enabled preview, with its own key | Production key if Groq is selected | Never |
| `GROQ_MODEL` | `.env.local` | With the key | Tested model id | Never |
| `ZAP_TARGET_URL` | — | — | — | Repository secret read by the ZAP baseline workflow |
| `ANTHROPIC_API_KEY` | — | — | — | Repository secret read only by the Claude security review workflow; a dedicated key with a spend limit, never an app variable |

Locally, copy `.env.example` to `.env.local` and fill in the values. In Vercel, add them under **Project → Settings → Environment Variables**, choose the environment, then redeploy: changes apply to new deployments only. In GitHub, add `ZAP_TARGET_URL` and `ANTHROPIC_API_KEY` under **Settings → Secrets and variables → Actions**. CI needs no secret; without `ANTHROPIC_API_KEY` the Claude security review is skipped.

Commit an `.env.example` with placeholders and ignore local secret files. Keep secrets out of builds, client variables, CI logs and fixture files. Environment changes apply to new Vercel deployments. Revoke and replace any exposed key, even if the commit is later removed. Configure service quota or usage limits and verify how they behave before enabling AI.

Target Montréal (`yul1`) for Vercel Functions if available on the selected configuration. Verify the actual function region and document it. Evaluate CDN ingress, firewall, logs, subprocessors, support access and AI processing separately. Montréal compute alone establishes only the configured compute location.

## Perimeter and application controls

1. Configure and test a Vercel Firewall rate limit on the planning endpoint by source, starting at five requests per minute if supported. Record the effective threshold and verify that excessive traffic is limited. Monitor forecast traffic and add an API-wide bound if the plan supports it and usage warrants it.
2. Require HTTPS. Verify response headers, including `X-Content-Type-Options`, a restrictive referrer policy and clickjacking protection through CSP `frame-ancestors`. Keep API cross-origin access disabled. Test any wider CSP directives on the actual Next.js deployment.
3. Use a bounded JSON body for planning requests, strict schemas and fixed outbound provider hosts. Reject oversized payloads before parsing the whole body. Use deadlines for provider calls and keep the AI path within the overall budget in the product spec.
4. Review lockfile changes, dependency alerts and secrets scanning results. Test logs on success and failure. Allowed application fields include the route name, status category, provider outcome and elapsed time. For the planning route, an agent fallback is logged with status `2xx` and an outcome such as `model_timeout`, `model_quota`, `model_http_error`, `model_invalid_response`, `model_network`, `tool_rejected`, `tool_limit`, `turn_limit`, `no_tool_result` or `result_mismatch`; model text, tool payloads and keys are never logged. Review what Vercel and other vendors collect independently.

## Interface assets and backdrop

The city catalogue (WEA-23) is a static asset, `public/data/cities-na.v1.json` (about 560 KB, 215 KB compressed), generated from the GeoNames `cities5000` dump (CC BY 4.0, credited in the footer) by `node scripts/build-cities.ts <cities5000.txt>` and committed; builds and CI make no network call for it. Browsers download it from the app's own origin on the first focus of a city search; the server imports the same file to resolve city IDs. It adds no outbound destination, identifier or log field. The display-units choice is stored in the browser's `localStorage` under `weather-window.units` and never sent.

The fonts (Inter and Pixelify Sans) are downloaded from Google Fonts at build time by `next/font` and served from the app's own origin, so visitors' browsers make no request to Google; the build environment needs access to Google Fonts. The pixel-art backdrop (UI-01) requests `GET /api/weather?cityId=montreal-qc` from the same origin and shares the five-minute forecast cache. It refreshes shortly before the forecast expires while the tab is visible, at most once a minute. It adds no outbound destination, visitor data, identifier or log field. The Open-Meteo request adds the public `is_day` current-conditions field.

## Privacy review before public release

Identify who operates the deployment and whether the Québec private-sector statute applies to the activity and the data. Review any identifiable data handled by the app, host, firewall, logs, AI provider and any operational tools. For relevant interprovincial or international commercial personal-information flows, assess PIPEDA too.

If the Québec private-sector statute applies and this project involves personal information, complete a proportionate privacy impact assessment under section 3.3 and involve the privacy officer from the beginning. Where section 17 applies, assess any disclosure or delegated processing of personal information outside Québec before it starts. Document safeguards, applicable law and why protection is adequate, and ensure the written agreement reflects the assessment. Review service-provider terms and applicable contractual requirements. Keep assessment evidence and actual supplier agreements in a private record.

Publish a plain-language privacy notice and make it accessible from the app. Verify operator identity, contact, purposes, data categories, recipients, locations where relevant, retention and rights or request process against actual settings. Address any applicable language obligations. The interface and the notice are offered in English and French (UI-02); English is the default and the language choice is not stored or sent. Before public release, have the French text and its match with the English notice reviewed, and decide whether the default language meets those obligations. If the law applies, confirm the privacy lead's published title and contact, governance practices, complaint and rights handling, and incident register. Record the access, retention and deletion arrangements for provider logs. Revisit the assessment before adding accounts, geolocation, analytics, chat or a new processor.

Confirm the intended use is allowed by the selected hosting, weather and AI terms. Verify the data settings of the enabled AI provider (Groq or Google Gemini) and record its actual retention configuration. Gemini API terms differ between unpaid and paid tiers for how prompts may be used, so confirm the billing tier of the production key. The model payload is limited to approved, non-identifying planning values and public forecasts regardless of the provider's retention option.

| Data flow | Expected data | Evidence to record privately |
|---|---|---|
| Browser to hosting perimeter | Connection metadata, city ID and validated planning inputs | Edge and firewall logging settings, recipients, access, retention and processing locations. Confirm which app fields appear in platform logs. |
| Host geo headers to application | Approximate latitude and longitude from the host, read on the server to pick the default catalogue city; never stored, logged or forwarded | Confirm the headers are not written to platform or application logs, and record the privacy impact for review (IP-derived default city, `src/lib/geo`). |
| Application to weather provider | Public city-centre coordinates and the catalogue IANA time zone | Actual outbound request fields and applicable provider terms. |
| Application to AI provider | Approved planning parameters and minimal public forecast data: the future hours (UTC instant, precipitation probability, sustained wind) of the requested day, or of up to three days for "I'm flexible" (at most 72 hourly points, WEA-25) | Payload test, account data controls, provider processing locations and applicable terms. |
| Application diagnostics | Allowlisted operational fields | Example redacted log entries, access list and effective platform retention. |

References

- [Québec private-sector privacy statute](https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-39.1)
- [Commission d’accès à l’information | Main Law 25 changes](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25)
- [Office of the Privacy Commissioner of Canada | Application of PIPEDA](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/02_05_d_26/)
- [Vercel regions](https://vercel.com/docs/regions) · [Firewall rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) · [Rollback](https://vercel.com/docs/instant-rollback)
- [GroqCloud data controls](https://console.groq.com/docs/your-data) · [Groq terms](https://console.groq.com/docs/legal/services-agreement) · [Gemini API terms](https://ai.google.dev/gemini-api/terms) · [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai) · [Open-Meteo terms](https://open-meteo.com/en/terms)

## Release and verification

1. Run lint, typecheck, tests and build on the release SHA. Review the preview, including mobile, keyboard navigation and simulated provider failures.
2. Merge the reviewed PR and verify Vercel's production deployment SHA. Check the HTTPS URL in a signed-out browser. Verify the repository is accessible to the evaluators.
3. Verify city search, forecast rendering, a live AI tool call and the labeled rule-based fallback. Confirm with logs that provider errors are actionable and user payloads are absent. Check rate limiting with low-volume requests from a controlled source and verify that the app recovers after the window.
4. Record the production URL, SHA, checked model, function region, firewall thresholds, provider data settings, date and verification results. Keep configuration details that could expose credentials or identifying logs in a private operations record.

## Release record

Fill this table for the release commit. Keep credentials and identifying log excerpts in the private operations record. `npm run check:release` fails while the privacy notice facts (`src/lib/privacy-settings.ts`) or the README release table still contain placeholders.

### Automated evidence (every pull request)

| Check | Where | What it proves |
|---|---|---|
| Verify (lint, typecheck, unit, build, client-bundle check, Playwright) | GitHub Actions `ci.yml` | Behaviour, security headers, privacy notice link, no AI configuration in the client bundle |
| Gitleaks | `gitleaks.yml` | No secret in repository history |
| OSV-Scanner, Trivy | `osv-scanner.yml`, `trivy.yml` | No known vulnerable dependency or high-severity misconfiguration |
| Dependency review | `dependency-review.yml` | The PR adds no dependency with a HIGH or CRITICAL advisory |
| CodeQL | GitHub code scanning default setup (JavaScript/TypeScript, Actions) | No open static-analysis alert in the application code or workflows |
| Claude security review | `claude-security-review.yml` | The diff was reviewed against the project boundaries; findings are answered in the PR (advisory, needs `ANTHROPIC_API_KEY`) |
| actionlint | `actionlint.yml` | Workflows are valid |
| OpenSSF Scorecard | `scorecard.yml` (push to `main`, weekly) | Supply-chain practices score, published in the README badge |

Third-party actions are pinned to full commit SHAs and updated by Dependabot. The Claude security review sends the pull request diff (source code, no visitor data) to Anthropic; it adds no runtime processor and runs only for pull requests from this repository.

### Production checks (maintainer)

| # | Check | How | Result |
|---|---|---|---|
| 1 | Verify passes on the release commit | GitHub Actions run for the merge commit | _pending_ |
| 2 | Production URL and deployed SHA | Vercel deployment details; record in README | Recorded 2026-11-24: `https://weather-use-case-rho.vercel.app` serves SHA `29f84ee` (`main`) |
| 3 | Function region | Vercel project settings and a function response | Passed 2026-11-24: function region set to `yul1`; `x-vercel-id` on `POST /api/plan` is `yul1::yul1::…` and the function log reports `region=yul1`. Before that change functions ran in `iad1` (Washington, US) |
| 4 | Environment variables | `AI_ENABLED`, `AI_PROVIDER` and the selected provider's key and model (`GEMINI_*` or `GROQ_*`) set for Production only; Preview keyless with `AI_ENABLED=false` | Checked 2026-11-24 (names only): Production has `AI_ENABLED`, `AI_PROVIDER=groq`, `GROQ_API_KEY`, `GROQ_MODEL`, plus an unused `GEMINI_API_KEY` without `GEMINI_MODEL`; no variable targets Preview |
| 5 | Rate limit on `/api/plan` | Vercel Firewall rule (start at 5 requests per minute per source); send a short burst from a controlled source, confirm limiting and recovery | Passed 2026-11-24: rule `Rate limit planning API` (`POST` + path `/api/plan`, fixed window 60 s, 5 requests per IP, action deny). A burst of 7 requests with an empty `{}` body (no provider calls) returned 400 ×5 then 403 ×2; a request 65 s later returned 400 again. Blocked requests get 403, which the form shows as "planning unavailable". Vercel managed rules (gen, rce, sqli, xss) are active in log mode only |
| 6 | Signed-out desktop and mobile test | Private window on desktop and a phone: search, forecast, planning, keyboard navigation | Partial 2026-11-20, signed-out browser at 1280 px and 375 px: keyboard city search (Vancouver), forecast, planning with the guide, no horizontal scroll on mobile. Phone test still to do |
| 7 | AI path | Planning result labelled AI-assisted with the production key | Passed 2026-11-24 on SHA `29f84ee` with `AI_PROVIDER=groq` and the tested model `openai/gpt-oss-20b` (the `GROQ_MODEL` value is encrypted in Vercel and was entered by the maintainer): a synthetic Laval request returns `"mode":"agent"` in about 1.4 s, and a direct Groq call with the same tool format returns 200 with a `get_day_forecast` call. Earlier failures (2026-11-20 to 2026-11-24) logged `model_http_error`: `GROQ_API_KEY` held an xAI Grok key, which Groq rejects with 401 |
| 8 | AI failure | Preview with an invalid key or `AI_ENABLED=false`: same result labelled rule-based, forecast still works | Passed 2026-11-24: the PR #16 preview (no AI variables, so AI disabled) answered `/api/weather?cityId=laval-qc` with 200 and `POST /api/plan` (Laval, walking, 2026-11-25, 2 h) with the same window as production (`match`, 14:00–16:00 UTC, 0 %, 2.2 km/h) labelled `rule-based`, while production returned `agent`. Invalid-key case observed in production 2026-11-20 to 2026-11-24: Groq 401, logged `model_http_error`, planner result labelled `rule-based` |
| 9 | Weather failure | Covered by CI (provider failure tests); on a preview, confirm the retryable error state | _pending_ |
| 10 | Security headers | `curl -sI <url>` and `curl -sI <url>/api/weather?cityId=laval-qc`: CSP `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, referrer and permissions policies, HSTS | Passed 2026-11-20 on `/`, `/privacy` and `/api/weather`: CSP `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies, HSTS, COOP; no `X-Powered-By`; `/api/weather` is `no-store`; a text `POST /api/plan` returns 415 |
| 11 | Keys stay server-side | CI client-bundle check on the release commit; Gitleaks passes; no key in function logs | _pending_ |
| 12 | Logs | Vercel function logs show only `route`, `status`, `outcome`, `elapsedMs` entries | Partial 2026-11-24: application entries contain only these four fields; a successful agent run writes no entry. Vercel adds its own request metadata (deployment, request ID, domain, region, runtime); check platform-level fields and retention separately |
| 13 | Privacy notice | `/privacy` matches operator, contact, region, the enabled AI provider and its retention; `npm run check:release` passes | Passed 2026-11-24 after PR #16: `npm run check:release` reports complete on `main` (`fa10adf`); live `/privacy` shows operator AN45 Labs, region `yul1 (Montréal, Canada)`, Groq and review date 2026-11-24. Groq retention is stated as the unchanged default account settings, not a confirmed retention period |
| 14 | ZAP baseline | Run `zap-baseline.yml` against the production URL; review findings | _pending_ |

## Rollback and incidents

For a failing model, set `AI_ENABLED=false` and redeploy so weather and the rule-based planner remain available. For a breaking app deploy, restore the last known-good eligible production deployment through Vercel or revert the offending change on `main` and redeploy. Check deployment age, bundled environment and credentials before restoring an old build. A revoked credential stays revoked. Retest the public URL and reconcile `main` with production.

For a suspected privacy incident, contain the exposure, preserve only needed evidence with restricted access, and alert the privacy lead where applicable. Record incidents involving personal information in the required register if the law applies. If there is a risk of serious injury, notify the Commission d’accès à l’information and affected persons with diligence as required. Record the decision, communications and corrective actions in the private incident record.

## Pull request environments

Follow the [team workflow](team-workflow.md) to connect the repository to Linear and Vercel. Run the GitHub Actions Verify job on the PR and review its Vercel preview. CI starts the built Next.js app locally for Playwright. After merging, verify the real production deployment separately and record its SHA.
