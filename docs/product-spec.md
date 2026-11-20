# Weather Window | Product specification

Status — proposed baseline for the hiring exercise. Implementation and release evidence will be recorded in the pull requests and deployment record.

## Objective and scope

Deliver a public React weather app that helps people check the forecast and choose an outdoor activity window. The first release supports a curated catalogue of Canadian cities, one responsive English interface, metric units and one planning workflow. Accounts, browser geolocation, street addresses, free-form AI chat, analytics, advertising, notifications and persistent user history are outside the first release.

The catalogue stores public city identifiers, labels, province codes, city-centre coordinates and IANA time zones. Include Laval, Montréal and at least one city in a different time zone. Local search runs in the browser. Search keystrokes stay there, and every API request uses an identifier from the catalogue.

## Functional acceptance criteria

| ID | Requirement | Evidence |
|---|---|---|
| WX-01 | Select a city through keyboard-accessible local search. Forecast requests use the selected catalogue ID. Unknown IDs are rejected. | Browser test and request validation test. |
| WX-02 | Show current conditions, upcoming hourly forecasts and a five-day summary in the city's time zone, with units, fetch timestamp and Open-Meteo attribution. | Browser smoke test and fixed forecast tests across time zones. |
| WX-03 | Provide loading, no-results and retryable error states. Missing readings are shown as unavailable. Expired forecasts are never presented as current. | Provider failure and incomplete-response tests. |
| AG-01 | Select hiking, cycling or walking, a date within the forecast horizon, and a whole-hour duration from one to four hours. Visitors do not set thresholds: the server applies the default maximum precipitation probability and sustained wind speed for the selected activity (see [Default activity thresholds](#default-activity-thresholds)) and shows them as the constraints used. Show the constraints used and the best eligible window when one exists. | Fixed forecast fixtures and live smoke test. |
| AG-02 | When the forecast covers the requested period and every window fails, clearly report that no window met the criteria. When missing or stale data prevents a confident result, show that the forecast is insufficient. | No-match, incomplete forecast and stale-data tests. |
| AG-03 | The model requests read-only tools through a bounded server orchestrator. The API returns recommendations only after the planner evaluates eligible windows. Render dates, hours and figures directly from the planner result. | Integration test using a fake model, including an unsolicited tool call and a proposal with no valid tool result. |
| AG-04 | A model timeout, quota error or disabled AI feature leaves the forecast usable. When forecast data is usable, offer the same rule-based planner and label the result as rule-based. | Model failure and fallback tests. |
| AG-05 | A planning guide (the cloud character Cirrus) sits beside the form on wide screens and above it on narrow screens. Predefined prompts follow the missing or completed fields, field errors and the result. The guide only reads form state: it never fills, validates or submits the form, accepts no free text or voice, needs no AI feature, and shows no times or weather figures. Its message is announced politely only when the guidance step changes, not for field errors, results or keystrokes, and its animation stops when reduced motion is requested. | Prompt unit tests and Playwright layout, keyboard, announcement and reduced-motion tests. |
| SEC-01 | Validate methods, schemas, ranges and request size before upstream work. Unknown fields or tool calls are rejected. Return safe, actionable errors. | API tests for invalid input, unknown tool and oversized requests. |
| SEC-02 | Secrets remain server-side. Rate limits operate at the hosting perimeter. Application logs contain only allowlisted operational fields. | Build and configuration review, deployed rate-limit test and log inspection. |
| PRIV-01 | Third-party AI requests contain only validated planning criteria and the minimum public forecast values needed for tool use. Publish a privacy notice based on actual production settings, with a working contact and retention information. | Outbound payload tests and review of the live notice against provider settings. |

## Forecast and planner rules

- Fetch public forecast data using catalogue coordinates. Cache only validated public forecasts keyed by catalogue city ID with a five-minute freshness target. Expired entries are treated as misses. Avoid caching errors and agent responses.
- Represent hourly points as UTC instants and display them using the selected city's IANA time zone. Resolve the requested day in that zone. Test a daylight-saving transition, including repeated and missing local hours.
- Consider future, consecutive full hours in the requested local day. Check every hour in each candidate against both inclusive maxima. Missing observations cannot pass a threshold. If an otherwise eligible window cannot be assessed due to missing readings and no valid result exists, report insufficient data.
- Rank valid windows by the lowest maximum precipitation probability, then lowest maximum sustained wind speed, then earliest start. Show what the result means, including that it describes forecast conditions for the city.

### Default activity thresholds

Thresholds vary by activity because the activities differ in exposure to wind, sensitivity to wet surfaces and distance from shelter; one shared pair would be too strict for walking or too loose for cycling. The server owns these values. Clients cannot send or override them, and every hour of a window must meet both inclusive maxima. Wind is the forecast sustained wind at 10 m for the city centre.

| Activity | Maximum precipitation probability | Maximum sustained wind | Rationale |
|---|---|---|---|
| Cycling | 20 % | 20 km/h | Wet roads reduce braking and visibility, and wind affects effort and stability the most. 20 km/h is the start of Beaufort 4 (moderate breeze). |
| Hiking | 30 % | 30 km/h | Longer outings away from shelter on trails that get slippery. 30 km/h is the start of Beaufort 5 (fresh breeze); city-centre wind already understates exposed terrain. |
| Walking | 40 % | 35 km/h | Short, flexible and close to shelter; an umbrella is practical and buildings cut the wind. |

The thresholds decide which windows are eligible; ranking is unchanged. Stricter values produce more no-match results in wet or windy weather. The rules do not consider gusts, temperature, precipitation type or daylight, so night hours can be recommended. Changing these values is a product decision that updates this table and the server policy together.

## Agent and tool boundary

The browser submits a strict JSON object containing a catalogue city ID, date, activity and duration. The server adds the thresholds from its policy and rejects any threshold field sent by a client. Planner results echo the effective criteria, thresholds included. Labels and model input are assembled by the application from validated values. There is no free-text field.

The initial API has two routes. `GET /api/weather?cityId=<id>` returns a validated public forecast or a safe error. `POST /api/plan` accepts only `application/json`, with a 2 KiB body limit, and returns a structured outcome and a mode of `agent` or `rule-based`. Use HTTP 400 for invalid criteria, 413 for oversized bodies, 415 for unsupported content types and 503 when usable forecast data cannot be fetched. Return normal domain outcomes such as no match with HTTP 200. `planning_unavailable` (HTTP 200, no forecast fetched) is returned only if the server threshold policy yields no valid values for the activity, which indicates a misconfiguration. Cache headers for planning responses must prevent shared caching.

The Groq model requests local function calls. The server scopes both tools to the validated request. The forecast tool retrieves the selected day's public forecast. The ranking tool evaluates that forecast using the planner and is available after a successful forecast tool call. The model can request tools, but it cannot alter the validated city, date or thresholds. Tool calls have strict schemas, no arbitrary destinations and no write actions. Both tools take no arguments; any argument, unknown tool, out-of-order or repeated call is rejected. The forecast tool returns only the future hours of the requested day as UTC instants with precipitation probability and sustained wind. Allow up to two tool calls and three model turns, with an overall eight-second application deadline for the agent path. The deterministic planner runs first; the response is labelled `agent` only when the model obtained the ranking tool result and that result equals the planner result, and model text is never displayed. Use the rule-based fallback when the model fails or returns an invalid result. Render the recommendation and its explanation from server-owned structured values and templates.

## Security and privacy boundaries

| Risk | Control |
|---|---|
| Abuse of a public AI endpoint | Per-source hosting rate limits, verified provider quota or usage cap, bounded execution and a server-side kill switch. Same-origin browser requests provide an additional browser policy. Non-browser callers are still subject to server validation and perimeter limits. |
| Untrusted input or model output | Strict server schemas. Resolve cities from the static catalogue. Call fixed provider endpoints. Render typed values through React and keep provider stack traces out of responses. |
| Secret exposure | Use project-scoped credentials and separate environments. Ignore local secret files and inspect the client build and public repository before release. |
| Disclosure via logs or vendors | Send neither user IP nor browser headers to weather or AI providers. Avoid logging bodies, tool payloads, raw IPs, cookies, headers or secret values in application code. Review provider edge, firewall, support and log access separately. |

The app has no application database or visitor identifiers. IP addresses and connection metadata may still be processed by the host or security layer. Treat any metadata that can identify a person as potentially personal. The proposal is privacy-by-design. Applicability and obligations depend on the actual operator and deployment. Follow the [deployment privacy review](deployment.md#privacy-review-before-public-release).

## Browser acceptance evidence

Playwright covers the Laval planning journey with fixed inputs in both AI-assisted and rule-based modes. The server integration tests cover the actual fallback decision. Link both sets of results to the acceptance criterion in the pull request. See the [browser-test contract](team-workflow.md#browser-test-contract).
