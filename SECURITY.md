# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub: open the repository's **Security** tab and select **Report a vulnerability**. Do not open a public issue or pull request for a security problem.

Include the affected URL or file, the steps to reproduce and the impact you observed. Use synthetic data only; do not send real credentials, personal data or provider logs.

You can expect an acknowledgement within five working days. Fixes are released on `main` and deployed to the public app; the advisory is published once the fix is live.

## Supported versions

Only the current `main` branch and its production deployment are supported.

## Scope

In scope: the Weather Window application code, its API routes (`/api/weather`, `/api/plan`), the agent and tool boundary, and this repository's GitHub Actions workflows. Out of scope: Vercel, Open-Meteo, Groq and Google Gemini themselves (report those to the provider), volumetric denial of service and automated scanner output without a demonstrated impact.

The security and privacy controls are described in the [product specification](docs/product-spec.md#security-and-privacy-boundaries) and the [deployment specification](docs/deployment.md#perimeter-and-application-controls).
