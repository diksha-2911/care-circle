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

        if not circle_id:
            continue

        tokens = _get_caregiver_tokens(db, circle_id)

        if alert["type"] == "missed_dose":
            title = "💊 Missed Medication"
            body = (
                f"{alert['drug_name']} {alert['dosage']} "
                "was not taken on time."
            )

        elif alert["type"] == "refill_needed":
            title = "💊 Refill Needed"
            body = (
                f"{alert['drug_name']} is running low "
                f"({alert['quantity_remaining']} remaining)."
            )

        elif alert["type"] == "appointment_reminder":
            title = "📅 Appointment Reminder"
            body = (
                f"Appointment with {alert['doctor_name']} "
                f"is coming up."
            )

        else:
            continue

        for token in tokens:
            try:
                send_push(token, title, body)
                sent += 1
            except Exception as error:
                print(f"Failed to send push notification: {error}")

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