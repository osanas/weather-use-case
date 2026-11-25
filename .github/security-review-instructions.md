Weather Window project boundaries. Report a finding when a change breaks one of them, in addition to the default categories.

- Provider credentials (`GEMINI_*`, `GROQ_*`, `AI_*`) are read only in server code. Flag any use in a client component, a `NEXT_PUBLIC_` variable, a response body or a log line.
- Every API request resolves its city ID in the static catalogue (`src/lib/catalogue.ts`). Flag code that forwards client-supplied coordinates, names, free text, IP addresses or request headers to Open-Meteo or to the AI provider.
- `POST /api/plan` accepts only `application/json` within a 2 KiB limit, with a strict schema that rejects unknown fields and any client-sent threshold. Flag a weakened schema, a missing size check or parsing before the size check.
- The model may call only the two fixed, argument-free, read-only tools in `src/lib/agent/tools.ts`, at most twice, within three turns and the eight-second deadline. Flag a new tool, a tool with arguments, a dynamic outbound URL or a raised budget.
- Model text and provider output are untrusted: they are never rendered, and recommendations come from the deterministic planner. Flag rendering model or provider text, or any new `dangerouslySetInnerHTML` (the only one, in `src/components/world/PixelArt.tsx`, renders sprite markup generated from fixed pixel grids).
- Application logs contain only `route`, `status`, `outcome` and `elapsedMs`. Flag logging of bodies, tool payloads, headers, IPs, cookies, approximate location or secrets.
- Security headers come from `src/lib/security-headers.ts`. Flag removing CSP `frame-ancestors`, `nosniff`, HSTS or the referrer policy, or enabling cross-origin API access.

Do not report: synthetic fixtures in `*.test.ts` or `tests/e2e`, the public city catalogue in `public/data`, or the placeholder values in `.env.example`.
