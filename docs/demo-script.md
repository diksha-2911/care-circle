# Demo Script (≤3 min)

1. **Setup (10s)** — show the care circle with a parent + two children already
   configured, one prescription with a personalized alarm time.
2. **Alexa+ voice logging (30s)** — "Alexa, I just took my blood pressure
   medication." MCP server logs it to Supabase in real time.
3. **App reflects it live (15s)** — switch to the sibling's phone, show the
   dose just logged appearing without refreshing (Supabase Realtime).
4. **Missed dose flag (20s)** — fast-forward (pre-staged) to a missed evening
   dose; sibling's phone receives a push notification.
5. **Refill alert (15s)** — show a prescription crossing its threshold,
   triggering a refill notification.
6. **SOS (20s)** — tap SOS in the app; show both push + SMS firing.
7. **Alexa+ inline widget (20s)** — "Alexa, show me today's medication
   schedule" → MCP Apps renders a visual schedule card in the Alexa+
   conversation view.
8. **Close (10s)** — one line on what's stubbed (OCR confidence UI, multi-circle
   support) and the real-world impact story.

## Known stubs / simplifications for the MVP

- Prescription OCR (Textract) confirms extraction but doesn't yet handle
  handwriting or non-standard formats.
- Only one care circle per demo account (multi-circle support is modeled in
  the schema but not yet built into the UI).
- Alexa+ proactive reminders are demoed via the MCP Apps widget rather than
  a live device, due to hackathon hardware access.
