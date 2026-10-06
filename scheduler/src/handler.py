"""AWS Lambda entrypoint, invoked on a schedule by EventBridge Scheduler
(see ../template.yaml). Checks for due doses, low-stock refills, and
upcoming appointments, then dispatches notifications for each.
"""
import os
from supabase import create_client

from check_due_doses import check_due_doses
from check_refills import check_refills
from check_appointments import check_appointments
from notify import send_push

def _get_db():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def lambda_handler(event, context):
    db = _get_db()

    alerts = []
    alerts += check_due_doses(db)
    alerts += check_refills(db)
    alerts += check_appointments(db)

    notifications_sent = _send_alerts(db, alerts)

    return {
        "statusCode": 200,
        "alerts_found": len(alerts),
        "notifications_sent": notifications_sent,
    }

def _send_alerts(db, alerts):
    sent = 0

    for alert in alerts:
        circle_id = alert.get("circle_id")
        alert_type = alert.get("type")

        if not circle_id or not alert_type:
            continue

        # Use the underlying event ID as the unique reference.
        if alert_type == "missed_dose":
            reference_id = alert["dose_log_id"]

        elif alert_type == "refill_needed":
            reference_id = alert["prescription_id"]

        elif alert_type == "appointment_reminder":
            reference_id = alert["id"]

        else:
            continue

        # Check whether this alert was already sent.
        existing = (
            db.table("notification_logs")
            .select("id")
            .eq("alert_type", alert_type)
            .eq("reference_id", reference_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            print(
                f"Skipping duplicate alert: "
                f"{alert_type} / {reference_id}"
            )
            continue

        tokens = _get_caregiver_tokens(db, circle_id)

        if alert_type == "missed_dose":
            title = "💊 Missed Medication"
            body = (
                f"{alert['drug_name']} {alert['dosage']} "
                "was not taken on time."
            )

        elif alert_type == "refill_needed":
            title = "💊 Refill Needed"
            body = (
                f"{alert['drug_name']} is running low "
                f"({alert['quantity_remaining']} remaining)."
            )

        elif alert_type == "appointment_reminder":
            title = "📅 Appointment Reminder"
            body = (
                f"Appointment with {alert['doctor_name']} "
                "is coming up."
            )

        for token in tokens:
            try:
                send_push(token, title, body)
                sent += 1
            except Exception as error:
                print(f"Failed to send push notification: {error}")

        # Record the alert only after attempting delivery.
        if tokens:
            db.table("notification_logs").insert({
                "circle_id": circle_id,
                "alert_type": alert_type,
                "reference_id": reference_id,
            }).execute()

    return sent

def _get_caregiver_tokens(db, circle_id: str) -> list[str]:
    members = (
        db.table("circle_members")
        .select("user_id")
        .eq("circle_id", circle_id)
        .eq("role", "caregiver")
        .execute()
    )

    if not members.data:
        return []

    user_ids = [member["user_id"] for member in members.data]

    tokens = (
        db.table("device_tokens")
        .select("token")
        .in_("user_id", user_ids)
        .execute()
    )

    return [row["token"] for row in tokens.data]