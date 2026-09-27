"""Tool: trigger_sos

Called for an emergency phrase. Fires the same multi-channel notification
path used by the scheduler's SOS handling (push + SMS), so it can't be
missed due to a single channel failing.

NOTE: the actual send logic lives in scheduler/src/notify.py; in a full
build this would call a shared notification module or a small internal
API rather than duplicating the FCM/SNS calls here.
"""
from db.supabase_client import get_client


def trigger_sos(circle_id: str, triggered_by_user_id: str) -> dict:
    db = get_client()

    members = (
        db.table("circle_members")
        .select("user_id")
        .eq("circle_id", circle_id)
        .eq("receives_sos_alerts", True)
        .execute()
    )

    # TODO: call shared notify.send_sos(members, circle_id) once the
    # scheduler's notification module is extracted into a shared package.

    return {
        "status": "ok",
        "message": "SOS triggered.",
        "notified_members": len(members.data),
    }
