"""Finds appointments happening within the next 24 hours."""
from datetime import datetime, timedelta, timezone


def check_appointments(db) -> list[dict]:
    now = datetime.now(timezone.utc)
    window_end = (now + timedelta(hours=24)).isoformat()

    upcoming = (
        db.table("appointments")
        .select("id, circle_id, doctor_name, appointment_time")
        .gte("appointment_time", now.isoformat())
        .lte("appointment_time", window_end)
        .execute()
    )

    return [
        {"type": "appointment_reminder", **appt}
        for appt in upcoming.data
    ]
