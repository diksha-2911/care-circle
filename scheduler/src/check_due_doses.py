from datetime import datetime, timedelta, timezone

MISSED_GRACE_PERIOD_MINUTES = 30


def check_due_doses(db) -> list[dict]:
    now = datetime.now(timezone.utc)

    cutoff = (
        now - timedelta(minutes=MISSED_GRACE_PERIOD_MINUTES)
    ).isoformat()

    overdue = (
        db.table("dose_logs")
        .select(
            "id, prescription_id, scheduled_time, status, "
            "prescriptions(circle_id, drug_name, dosage)"
        )
        .eq("status", "pending")
        .lt("scheduled_time", cutoff)
        .execute()
    )

    alerts = []

    for dose in overdue.data:
        prescription = dose.get("prescriptions")

        if not prescription:
            continue

        db.table("dose_logs") \
            .update({"status": "missed"}) \
            .eq("id", dose["id"]) \
            .execute()

        alerts.append({
            "type": "missed_dose",
            "dose_log_id": dose["id"],
            "circle_id": prescription["circle_id"],
            "drug_name": prescription["drug_name"],
            "dosage": prescription["dosage"],
            "scheduled_time": dose["scheduled_time"],
        })

    return alerts