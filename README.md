# AIResQ ClimSols — Crowd-Sourced Flood Reporting

Minimal, field-usable platform to collect flood depth + photo proofs from citizens and government staff. Stores submissions as JSON under `crowd_data/` and provides a simple admin review/export + X crawl + GenAI extraction.

## Quick Start

1. **Setup Environment**:
   - Copy `.env.example` to `.env`
   - Fill in the required values (especially `ADMIN_USER`, `ADMIN_PASS`, and API keys if using X/OpenRouter features).

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Server**:
   ```bash
   # Development
   python app.py
   
   # Production (Windows/Linux/Mac)
   python serve.py
   
   # Production (Linux/Docker only)
   gunicorn -c gunicorn.conf.py app:app
   ```
   The application will be available at `http://localhost:8005`.

## Docker Usage

1. **Build the Image**:
   ```bash
   docker build -t airesq-crowdsourcing .
   ```

2. **Run the Container**:
   ```bash
   docker run -p 8005:8005 --env-file .env -v ${PWD}/crowd_data:/app/crowd_data airesq-crowdsourcing
   ```

## Public Submission
- **Mobile-First**: Optimized for field use.
- **Required Fields**: Name, phone, flood depth (slider), photo proof, and simple captcha.
- **Optional Fields**: Street, zone, ward, vehicle type, and remarks.
- **Auto-Capture**: Automatically records GPS coordinates and timestamps.

## Storage Structure
- **Submissions**: `crowd_data/submissions/<id>.json`
- **Images**: `crowd_data/images/<filename>`
- **Thumbnails**: `crowd_data/thumbnails/<filename>`
- **Intelligence**: `crowd_data/intel/*.json` (X crawl + LLM extraction)
- **Volunteers**: `crowd_data/volunteers/*.json`
- **Scraped News**: `crowd_data/scraped_news/*.json`

## Admin Features
- **Authentication**: Protected by `ADMIN_USER` and `ADMIN_PASS`.
- **Data Management**: Review submissions, view photos, and export data to JSON/CSV.
- **X (Twitter) Integration**: Crawl X for flood-related hashtags.
- **AI Extraction**: Use OpenRouter to summarize and extract structured info from news and social media.

## Environment Variables
- `ADMIN_USER` / `ADMIN_PASS`: Admin dashboard credentials.
- `CAPTCHA_SECRET`: Secret for the built-in simple captcha.
- `JWT_SECRET`: Secret for signing session tokens.
- `X_BEARER_TOKEN`: X API v2 Bearer Token for crawling.
- `OPENROUTER_API_KEY`: API key for OpenRouter (GenAI features).
- `AI_API_BASE`: Base URL for local AI services if applicable.

## Notes
- Designed for reliability and clarity; no heavy dashboards.
- All data is local filesystem; avoid PII sharing.
