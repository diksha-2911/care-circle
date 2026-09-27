# Care Circle

A caregiver coordination app that keeps families on the same page about an aging
parent's medications, appointments, and wellbeing — with an Alexa+ voice integration
so the parent can log doses and get reminders hands-free.

## Why three separate pieces?

See [`docs/architecture.md`](docs/architecture.md) for the full breakdown. In short:

- `app/` — a React Native app for setup, monitoring, and manual logging
- `mcp-server/` — a Python MCP server that lets Alexa+ talk to the same data
- `scheduler/` — a background job that fires medication/refill/appointment alerts
  on a timer, independent of the app or Alexa+ being active
- `supabase/` — the shared Postgres database all three read/write to

## Prerequisites

- Node.js 18+
- Python 3.11+
- A free [Supabase](https://supabase.com) project
- An AWS account (for the MCP server deployment + Lambda scheduler)
- Expo CLI (`npm install -g expo-cli`)

## Setup

### 1. Database

```bash
cd supabase
# create a Supabase project at supabase.com, then link it:
npx supabase link --project-ref <your-project-ref>
npx supabase db push   # applies migrations/
psql <connection-string> -f seed.sql   # optional demo data
```

### 2. App

```bash
cd app
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npx expo start
```

### 3. MCP Server

```bash
cd mcp-server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in Supabase service key
python src/server.py   # runs locally on port 8000
# expose locally with: cloudflared tunnel --url http://localhost:8000
# register with Alexa+ via: alexa-ai deploy
```

### 4. Scheduler

```bash
cd scheduler
pip install -r requirements.txt
# deploy with AWS SAM:
sam build && sam deploy --guided
```

## Project status

Hackathon MVP — see `docs/demo-script.md` for what's demoed vs. what's stubbed.

## License

MIT — see [LICENSE](LICENSE).
