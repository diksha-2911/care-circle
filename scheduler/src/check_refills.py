"""Finds prescriptions that have crossed their refill threshold."""


def check_refills(db) -> list[dict]:
    prescriptions = db.table("prescriptions").select(
        "id, circle_id, drug_name, quantity_remaining, refill_threshold"
    ).execute()

    alerts = []
    for p in prescriptions.data:
        if p["quantity_remaining"] <= p["refill_threshold"]:
            alerts.append({
                "type": "refill_needed",
                "circle_id": p["circle_id"],
                "drug_name": p["drug_name"],
                "quantity_remaining": p["quantity_remaining"],
            })

    return alerts
