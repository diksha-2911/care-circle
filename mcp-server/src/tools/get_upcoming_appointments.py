"""Tool: get_upcoming_appointments

Called for queries like "Alexa, when's my next doctor's appointment?"
"""
from datetime import datetime, timezone
from db.supabase_client import get_client


def get_upcoming_appointments(circle_id: str, limit: int = 3) -> dict:
    db = get_client()

    appointments = (
        db.table("appointments")
        .select("doctor_name, appointment_time, notes")
        .eq("circle_id", circle_id)
        .gte("appointment_time", datetime.now(timezone.utc).isoformat())
        .order("appointment_time")
        .limit(limit)
        .execute()
    )

    return {"status": "ok", "appointments": appointments.data}
