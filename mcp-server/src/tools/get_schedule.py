"""Tool: get_medication_schedule

Called for queries like "Alexa, what medications do I need to take today?"
"""
from db.supabase_client import get_client


def get_medication_schedule(circle_id: str) -> dict:
    db = get_client()

    prescriptions = (
        db.table("prescriptions")
        .select("drug_name, dosage, alarm_times, quantity_remaining")
        .eq("circle_id", circle_id)
        .execute()
    )

    return {"status": "ok", "prescriptions": prescriptions.data}
