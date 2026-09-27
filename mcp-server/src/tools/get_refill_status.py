"""Tool: get_refill_status

Called for queries like "Alexa, am I running low on anything?"
"""
from db.supabase_client import get_client


def get_refill_status(circle_id: str) -> dict:
    db = get_client()

    prescriptions = (
        db.table("prescriptions")
        .select("drug_name, quantity_remaining, refill_threshold")
        .eq("circle_id", circle_id)
        .execute()
    )

    low_stock = [
        p for p in prescriptions.data
        if p["quantity_remaining"] <= p["refill_threshold"]
    ]

    return {"status": "ok", "low_stock": low_stock}
