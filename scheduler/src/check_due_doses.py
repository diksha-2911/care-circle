"""Finds doses that are due now or overdue and flags them as missed if
past their window, so downstream notification logic knows what to alert on.
"""
from datetime import datetime, timedelta, timezone

MISSED_GRACE_PERIOD_MINUTES = 30


def check_due_doses(db) -> list[dict]:
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(minutes=MISSED_GRACE_PERIOD_MINUTES)).isoformat()

    overdue = (
        db.table("dose_logs")
        .select("id, prescription_id, scheduled_time, status")
        .eq("status", "pending")
        .lt("scheduled_time", cutoff)
        .execute()
    )

    alerts = []
    for dose in overdue.data:
        db.table("dose_logs").update({"status": "missed"}).eq("id", dose["id"]).execute()
        alerts.append({"type": "missed_dose", "dose_log_id": dose["id"]})

    return alerts
