# Weather Window

A weather app with an assistant that finds the best forecast window for an outdoor activity.

| Release information | Value |
|---|---|
| Public app | _Fill in after the production smoke test._ |
| Source repository | _Fill in before submission._ |
| Deployed commit | _Fill in with the tested commit SHA._ |

This document describes the target implementation for the hiring exercise. The local commands below are the planned repository interface and must be checked against the implementation before submission.

## Try it

Select **Laval, Québec**, choose **Hiking**, pick a day within the forecast horizon and set the duration to two hours, then select **Find best time**. The server applies the comfort limits for the activity (hiking: at most 30 % precipitation probability and 30 km/h sustained wind) and evaluates live forecasts. The result may be a matching window, no match or insufficient forecast data, labelled AI-assisted or rule-based. Automated tests use fixed forecasts to demonstrate each outcome consistently.

## Architecture

The React application and server routes share a Next.js deployment. The browser searches a bundled city catalogue. Server code owns the upstream provider integrations and recommendation logic.

```mermaid
flowchart LR
    B["Browser · React"] --> E["Vercel edge · rate limits"]
    E --> A["Next.js server routes"]
    A --> W["Forecast service"]
    A --> O["Agent orchestrator"]
    O -->|"Bounded tool requests"| G["Groq model"]
    O -->|"Read forecast"| W
    O -->|"Rank windows"| P["Deterministic planner"]
    W -->|"Public city coordinates"| M["Open-Meteo"]
    A -->|"Rule-based fallback"| P
```

The model receives validated activity criteria and the minimum public forecast data used by its tools. The server computes candidate windows and produces the structured response. Conditions and times shown in the interface come from the forecast and planner. Weather data is attributed to [Open-Meteo](https://open-meteo.com/).

## Run locally

Use the Node.js version pinned by the repository and the committed npm lockfile.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). The app runs with the rule-based planner without an AI key.

### Configure the AI agent

The Groq agent is optional. It runs only when all three values are set; otherwise the app stays rule-based.

| Variable | Value | Where to get it |
|---|---|---|
| `AI_ENABLED` | `true` to use the agent, `false` (default) for rule-based only | — |
| `GROQ_API_KEY` | Your Groq API key | [console.groq.com/keys](https://console.groq.com/keys) |
| `GROQ_MODEL` | A Groq model id that supports tool calling | [Groq tool use](https://console.groq.com/docs/tool-use) |

1. Copy `.env.example` to `.env.local` (already ignored by Git) and fill in the three values.
2. Restart `npm run dev`. A planning result labelled **AI-assisted recommendation** confirms the agent path; **Rule-based recommendation** means the fallback was used.
3. Never commit `.env.local`, never prefix these variables with `NEXT_PUBLIC_`, and never paste a key into an issue, PR or chat. Gitleaks scans every pull request for leaked secrets.

For Vercel, set the same variables per environment as described in [Deployment](docs/deployment.md#where-to-set-each-value).

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Use fixed fixtures for CI and the live deployment for an end-to-end smoke test. See [Product specification](docs/product-spec.md) for acceptance criteria, [Deployment](docs/deployment.md) for release and incident procedures, and [Claude Code instructions](CLAUDE.md) for AI-assisted changes.

## Delivery workflow

Track work in Linear, link the ticket to a GitHub pull request, run the Verify check and review the Vercel preview before merging. The [team workflow](docs/team-workflow.md) contains setup instructions, the initial backlog and the Playwright contracts.

Every pull request runs CI (lint, typecheck, unit and browser tests, build) and security scans: Gitleaks for secrets, OSV-Scanner and Trivy for vulnerable dependencies and misconfiguration, and actionlint for the workflows. OWASP ZAP scans the deployed site weekly and Dependabot proposes updates. The [use-case presentation](docs/use-case-presentation.md) explains each check and includes the architecture, planning and workflow diagrams.
