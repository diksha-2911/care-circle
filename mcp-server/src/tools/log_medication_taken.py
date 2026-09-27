"""Tool: log_medication_taken

Called when a user tells Alexa+ they've taken a medication
(e.g. "Alexa, I just took my blood pressure medication").
"""
from datetime import datetime, timezone
from db.supabase_client import get_client


def log_medication_taken(circle_id: str, drug_name: str, user_id: str) -> dict:
    db = get_client()

    prescription = (
        db.table("prescriptions")
        .select("id, quantity_remaining")
        .eq("circle_id", circle_id)
        .ilike("drug_name", drug_name)
        .single()
        .execute()
    )

    if not prescription.data:
        return {"status": "error", "message": f"No prescription found for {drug_name}"}

    prescription_id = prescription.data["id"]
    now = datetime.now(timezone.utc).isoformat()

    db.table("dose_logs").insert({
        "prescription_id": prescription_id,
        "logged_by_user_id": user_id,
        "scheduled_time": now,   # simplified: for the MVP we log against "now"
        "taken_at": now,
        "status": "taken",
    }).execute()

    new_qty = max(prescription.data["quantity_remaining"] - 1, 0)
    db.table("prescriptions").update({"quantity_remaining": new_qty}).eq(
        "id", prescription_id
    ).execute()

    return {
        "status": "ok",
        "message": f"Logged {drug_name} as taken.",
        "quantity_remaining": new_qty,
    }
