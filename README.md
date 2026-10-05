# Care Circle

Care Circle is a family healthcare app for managing an aging parent's **medications, appointments, notes, and SOS alerts** in one shared place.

It is designed to integrate with **Alexa+ through MCP**, allowing a patient to access and update their care information conversationally. The Alexa+ experience is **currently simulated through a chat client**.

## Architecture

The project has three main components that share the same Supabase database:

```text
app/ ────────────────┐
                     │
mcp-server/ ─────────┼──→ Supabase
                     │
scheduler/ ──────────┘
```

* **`app/`** — React Native + Expo mobile app for patients and caregivers
* **`mcp-server/`** — Python MCP server exposing Care Circle actions to an AI assistant
* **`scheduler/`** — Background service for medication, refill, and appointment alerts
* **`supabase/`** — Database migrations and configuration

## Features

* User authentication
* Care circle creation and caregiver invites
* Role-based caregiver permissions
* Medication management and dose logging
* Local medication reminders
* Appointment tracking
* Care notes
* SOS alerts
* MCP tools for accessing and updating care data
* Authenticated MCP requests using Supabase

## MCP Tools

The MCP server currently exposes:

| Tool               | Purpose                       |
| ------------------ | ----------------------------- |
| `get_schedule`     | Get medication schedule       |
| `log_medication`   | Log a medication dose         |
| `get_refills`      | Check medications running low |
| `get_appointments` | Get upcoming appointments     |
| `add_note`         | Add a care note               |
| `sos`              | Trigger an SOS alert          |

The MCP server gets the authenticated user's identity from their Supabase access token and resolves their Care Circle server-side. The client does not send `user_id` or `circle_id`.

## Tech Stack

* **App:** React Native, Expo, TypeScript
* **MCP:** Python, FastMCP
* **Database/Auth:** Supabase, PostgreSQL
* **AI:** Groq
* **Infrastructure:** AWS, Docker

## Project Structure

```text
care-circle/
│
├── app/                 # React Native app
├── mcp-server/          # MCP server
├── scheduler/           # Background scheduler
├── supabase/            # Database migrations
│
└── docs/
    ├── architecture.md
    └── demo-script.md
```

## Setup

### Requirements

* Node.js 18+
* Python 3.11+
* Supabase
* Expo
* AWS for deployment

### 1. Database

```bash
cd supabase
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 2. App

```bash
cd app
npm install
cp .env.example .env
npx expo start
```

Add the Supabase URL and anon key to `.env`.

### 3. MCP Server

```bash
cd mcp-server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Add the required Supabase credentials to `.env`.

Run locally with:

```bash
python src/server.py
```

### 4. Scheduler

```bash
cd scheduler
pip install -r requirements.txt
sam build
sam deploy --guided
```

## Status

**Hackathon MVP**

### Completed

* Core mobile app
* Authentication and care circles
* Caregiver invites and permissions
* Medication management and local reminders
* Appointments, notes, and SOS
* Self-hosted MCP server
* Supabase authentication for MCP
* Six working MCP tools
* Chat-based Alexa+ simulation

### Remaining

* Deploy MCP server
* Complete and deploy background scheduler
* Caregiver push notifications
* Final end-to-end deployment testing

See [`docs/architecture.md`](https://github.com/tanuushree/care-circle/blob/main/docs/architecture.md) for more details.
