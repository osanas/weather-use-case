# Weather Window | Deployment specification

Status — proposed procedure. Complete the production record with verified settings and results before submission.

## Environments and configuration

Import the Git repository into Vercel as a Next.js project. Use `main` as the production branch. Use Preview deployments for pull requests. Require CI status checks before merging where repository settings support it. Protect preview access where available and keep the final production URL public. Leave source and build logs protected. Match the Node.js version in development, CI and Vercel.

| Variable | Configuration |
|---|---|
| `AI_ENABLED` | Defaults to `false`. Enable in production after validating the provider configuration and request path. |
| `GROQ_API_KEY` | Server-only credential. Use a separate key per environment that calls the model. Keep disabled previews keyless. |
| `GROQ_MODEL` | A specific Groq model identifier verified to support local tool calling. Record the tested identifier in the release record. |

Commit an `.env.example` with placeholders and ignore local secret files. Keep secrets out of builds, client variables, CI logs and fixture files. Environment changes apply to new Vercel deployments. Revoke and replace any exposed key, even if the commit is later removed. Configure service quota or usage limits and verify how they behave before enabling AI.

Target Montréal (`yul1`) for Vercel Functions if available on the selected configuration. Verify the actual function region and document it. Evaluate CDN ingress, firewall, logs, subprocessors, support access and AI processing separately. Montréal compute alone establishes only the configured compute location.

## Perimeter and application controls

1. Configure and test a Vercel Firewall rate limit on the planning endpoint by source, starting at five requests per minute if supported. Record the effective threshold and verify that excessive traffic is limited. Monitor forecast traffic and add an API-wide bound if the plan supports it and usage warrants it.
2. Require HTTPS. Verify response headers, including `X-Content-Type-Options`, a restrictive referrer policy and clickjacking protection through CSP `frame-ancestors`. Keep API cross-origin access disabled. Test any wider CSP directives on the actual Next.js deployment.
3. Use a bounded JSON body for planning requests, strict schemas and fixed outbound provider hosts. Reject oversized payloads before parsing the whole body. Use deadlines for provider calls and keep the AI path within the overall budget in the product spec.
4. Review lockfile changes, dependency alerts and secrets scanning results. Test logs on success and failure. Allowed application fields include the route name, status category, provider outcome and elapsed time. Review what Vercel and other vendors collect independently.

## Privacy review before public release

Identify who operates the deployment and whether the Québec private-sector statute applies to the activity and the data. Review any identifiable data handled by the app, host, firewall, logs, AI provider and any operational tools. For relevant interprovincial or international commercial personal-information flows, assess PIPEDA too.

If the Québec private-sector statute applies and this project involves personal information, complete a proportionate privacy impact assessment under section 3.3 and involve the privacy officer from the beginning. Where section 17 applies, assess any disclosure or delegated processing of personal information outside Québec before it starts. Document safeguards, applicable law and why protection is adequate, and ensure the written agreement reflects the assessment. Review service-provider terms and applicable contractual requirements. Keep assessment evidence and actual supplier agreements in a private record.

Publish a plain-language privacy notice and make it accessible from the app. Verify operator identity, contact, purposes, data categories, recipients, locations where relevant, retention and rights or request process against actual settings. Address any applicable language obligations. If the law applies, confirm the privacy lead's published title and contact, governance practices, complaint and rights handling, and incident register. Record the access, retention and deletion arrangements for provider logs. Revisit the assessment before adding accounts, geolocation, analytics, chat or a new processor.

Confirm the intended use is allowed by the selected hosting, weather and AI terms. Verify Groq's data settings and record its actual retention configuration. The model payload is limited to approved, non-identifying planning values and public forecasts regardless of the provider's retention option.

| Data flow | Expected data | Evidence to record privately |
|---|---|---|
| Browser to hosting perimeter | Connection metadata, city ID and validated planning inputs | Edge and firewall logging settings, recipients, access, retention and processing locations. Confirm which app fields appear in platform logs. |
| Application to weather provider | Public city-centre coordinates | Actual outbound request fields and applicable provider terms. |
| Application to AI provider | Approved planning parameters and minimal public forecast data | Payload test, account data controls, provider processing locations and applicable terms. |
| Application diagnostics | Allowlisted operational fields | Example redacted log entries, access list and effective platform retention. |

References

- [Québec private-sector privacy statute](https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-39.1)
- [Commission d’accès à l’information | Main Law 25 changes](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25)
- [Office of the Privacy Commissioner of Canada | Application of PIPEDA](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/02_05_d_26/)
- [Vercel regions](https://vercel.com/docs/regions) · [Firewall rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) · [Rollback](https://vercel.com/docs/instant-rollback)
- [GroqCloud data controls](https://console.groq.com/docs/your-data) · [Groq terms](https://console.groq.com/docs/legal/services-agreement) · [Open-Meteo terms](https://open-meteo.com/en/terms)

## Release and verification

1. Run lint, typecheck, tests and build on the release SHA. Review the preview, including mobile, keyboard navigation and simulated provider failures.
2. Merge the reviewed PR and verify Vercel's production deployment SHA. Check the HTTPS URL in a signed-out browser. Verify the repository is accessible to the evaluators.
3. Verify city search, forecast rendering, a live AI tool call and the labeled rule-based fallback. Confirm with logs that provider errors are actionable and user payloads are absent. Check rate limiting with low-volume requests from a controlled source and verify that the app recovers after the window.
4. Record the production URL, SHA, checked model, function region, firewall thresholds, provider data settings, date and verification results. Keep configuration details that could expose credentials or identifying logs in a private operations record.

## Rollback and incidents

For a failing model, set `AI_ENABLED=false` and redeploy so weather and the rule-based planner remain available. For a breaking app deploy, restore the last known-good eligible production deployment through Vercel or revert the offending change on `main` and redeploy. Check deployment age, bundled environment and credentials before restoring an old build. A revoked credential stays revoked. Retest the public URL and reconcile `main` with production.

For a suspected privacy incident, contain the exposure, preserve only needed evidence with restricted access, and alert the privacy lead where applicable. Record incidents involving personal information in the required register if the law applies. If there is a risk of serious injury, notify the Commission d’accès à l’information and affected persons with diligence as required. Record the decision, communications and corrective actions in the private incident record.

## Pull request environments

Follow the [team workflow](team-workflow.md) to connect the repository to Linear and Vercel. Run the GitHub Actions Verify job on the PR and review its Vercel preview. CI starts the built Next.js app locally for Playwright. After merging, verify the real production deployment separately and record its SHA.
