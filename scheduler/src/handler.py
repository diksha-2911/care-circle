"""AWS Lambda entrypoint for scheduled Care Circle notifications.

EventBridge invokes this handler every five minutes. A notification log row
acts as an atomic-ish claim for each alert event and allows failed/stale claims
to be retried without repeatedly sending alerts that were already delivered.
"""
from datetime import datetime, timedelta, timezone
import os

from supabase import create_client

from check_due_doses import check_due_doses
from check_refills import check_refills
from check_appointments import check_appointments
from notify import send_push

CLAIM_TTL = timedelta(minutes=10)


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


def _utc_now():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.isoformat()


def _parse_timestamp(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _claim_notification(db, circle_id, alert_type, reference_id):
    """Claim an event for delivery; return its log id or None if already claimed.

    The unique database constraint prevents two invocations from creating two
    event rows. Failed deliveries and claims older than CLAIM_TTL are eligible
    for retry. Conditional updates ensure only one invocation reclaims a row.
    """
    now = _utc_now()
    row = {
        "circle_id": circle_id,
        "alert_type": alert_type,
        "reference_id": reference_id,
        "status": "processing",
        "attempt_count": 1,
        "last_error": None,
        "updated_at": _iso(now),
        "claim_expires_at": _iso(now + CLAIM_TTL),
    }

    try:
        inserted = db.table("notification_logs").insert(row).execute()
        if inserted.data:
            return inserted.data[0]["id"]
        # Some client configurations may not return inserted rows.
        created = (
            db.table("notification_logs")
            .select("id")
            .eq("alert_type", alert_type)
            .eq("reference_id", reference_id)
            .limit(1)
            .execute()
        )
        return created.data[0]["id"] if created.data else None
    except Exception as insert_error:
        # Usually this is the unique constraint indicating another invocation
        # already claimed the event. Re-query to distinguish that from a DB
        # error and to decide whether a failed/stale claim can be reclaimed.
        try:
            result = (
                db.table("notification_logs")
                .select("id,status,attempt_count,claim_expires_at")
                .eq("alert_type", alert_type)
                .eq("reference_id", reference_id)
                .limit(1)
                .execute()
            )
        except Exception as query_error:
            print(f"Could not inspect notification log: {query_error}; insert error: {insert_error}")
            return None

        if not result.data:
            print(f"Could not claim notification event: {insert_error}")
            return None

        existing = result.data[0]
        if existing["status"] == "sent":
            print(f"Skipping already-sent alert: {alert_type} / {reference_id}")
            return None

        expiry = _parse_timestamp(existing.get("claim_expires_at"))
        is_stale = expiry is None or expiry <= now
        if existing["status"] == "processing" and not is_stale:
            print(f"Skipping alert claimed by another invocation: {alert_type} / {reference_id}")
            return None

        # Compare-and-set using the values we read. If another invocation wins
        # the update first, PostgREST returns no updated rows and this one exits.
        query = (
            db.table("notification_logs")
            .update({
                "status": "processing",
                "attempt_count": int(existing.get("attempt_count") or 0) + 1,
                "last_error": None,
                "updated_at": _iso(now),
                "claim_expires_at": _iso(now + CLAIM_TTL),
            })
            .eq("id", existing["id"])
            .eq("status", existing["status"])
        )
        if existing.get("claim_expires_at") is not None:
            query = query.eq("claim_expires_at", existing["claim_expires_at"])
        try:
            claimed = query.execute()
        except Exception as update_error:
            print(f"Could not reclaim notification event: {update_error}")
            return None
        return existing["id"] if claimed.data else None


def _finish_notification(db, log_id, status, error=None):
    now = _utc_now()
    update = {
        "status": status,
        "last_error": error[:2000] if error else None,
        "updated_at": _iso(now),
        # Expire the claim immediately for failures so the next scheduled run
        # can retry; successful rows remain deduplicated by status='sent'.
        "claim_expires_at": _iso(now if status == "failed" else now + CLAIM_TTL),
    }
    if status == "sent":
        update["sent_at"] = _iso(now)
    try:
        db.table("notification_logs").update(update).eq("id", log_id).execute()
    except Exception as error_update:
        print(f"Could not update notification log {log_id}: {error_update}")


def _send_alerts(db, alerts):
    sent = 0

    for alert in alerts:
        circle_id = alert.get("circle_id")
        alert_type = alert.get("type")

        if not circle_id or not alert_type:
            continue

        if alert_type == "missed_dose":
            reference_id = alert.get("dose_log_id")
        elif alert_type == "refill_needed":
            reference_id = alert.get("prescription_id")
        elif alert_type == "appointment_reminder":
            reference_id = alert.get("id")
        else:
            continue

        if not reference_id:
            print(f"Skipping alert without event reference: {alert_type}")
            continue

        log_id = _claim_notification(db, circle_id, alert_type, reference_id)
        if not log_id:
            continue

        try:
            tokens = _get_caregiver_tokens(db, circle_id)
            if not tokens:
                _finish_notification(
                    db,
                    log_id,
                    "failed",
                    "No caregiver device tokens registered for this circle.",
                )
                continue

            if alert_type == "missed_dose":
                title = "💊 Missed Medication"
                body = f"{alert.get('drug_name', 'Medication')} {alert.get('dosage', '')} was not taken on time.".strip()
            elif alert_type == "refill_needed":
                title = "💊 Refill Needed"
                body = (
                    f"{alert.get('drug_name', 'Medication')} is running low "
                    f"({alert.get('quantity_remaining', 'few')} remaining)."
                )
            else:
                title = "📅 Appointment Reminder"
                body = f"Appointment with {alert.get('doctor_name') or 'your doctor'} is coming up."

            successful_deliveries = 0
            delivery_errors = []
            for token in tokens:
                try:
                    send_push(token, title, body)
                    sent += 1
                    successful_deliveries += 1
                except Exception as error:
                    delivery_errors.append(str(error))
                    print(f"Failed to send push notification: {error}")

            if successful_deliveries:
                # Event-level logging: at least one caregiver device received
                # the alert. Per-device retry tracking can be added separately.
                _finish_notification(
                    db,
                    log_id,
                    "sent",
                    "; ".join(delivery_errors) if delivery_errors else None,
                )
            else:
                _finish_notification(
                    db,
                    log_id,
                    "failed",
                    "; ".join(delivery_errors) or "All push deliveries failed.",
                )
        except Exception as error:
            print(f"Failed to process alert {alert_type} / {reference_id}: {error}")
            _finish_notification(db, log_id, "failed", str(error))

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

    return [row["token"] for row in (tokens.data or [])]
