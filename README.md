# AIResQ ClimSols — Crowd-Sourced Flood Reporting

Minimal, field-usable platform to collect flood depth + photo proofs from citizens and government staff. Stores submissions as JSON under `crowd_data/` and provides a simple admin review/export + X crawl + GenAI extraction.

## Quick Start

1. Copy `.env.example` to `.env` and fill values.
2. Install deps and run the server:

```bash
npm install
npm run start
```

Open http://localhost:3000

## Public Submission
- No auth; mobile-first form
- Required: Name, phone, flood depth slider, photo, captcha
- Optional: street, zone, ward, vehicle type, remarks
- Auto-captures GPS and timestamp

## Storage
- JSON: `crowd_data/submissions/<id>.json`
- Images: `crowd_data/images/<filename>`
- Intelligence (X crawl + LLM): `crowd_data/intel/*.json`

## Admin
- Basic Auth (`ADMIN_USER`/`ADMIN_PASS`)
- Review submissions, export JSON/CSV
- Crawl X with predefined hashtags
- Summarize/extract useful flood info via OpenRouter

## Environment
- `ADMIN_USER`, `ADMIN_PASS`
- `CAPTCHA_SECRET`
- `X_BEARER_TOKEN` (X API v2)
- `OPENROUTER_API_KEY`, optional `OPENROUTER_MODEL`

## Notes
- Designed for reliability and clarity; no heavy dashboards.
- All data is local filesystem; avoid PII sharing.
