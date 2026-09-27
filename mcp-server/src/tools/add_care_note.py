"""Tool: add_care_note

Called for statements like "Alexa, tell my daughter the doctor said to
reduce the dosage next week."
"""
from db.supabase_client import get_client


def add_care_note(circle_id: str, author_user_id: str, note: str) -> dict:
    db = get_client()

    db.table("care_notes").insert({
        "circle_id": circle_id,
        "author_user_id": author_user_id,
        "note": note,
    }).execute()

    return {"status": "ok", "message": "Note added to the care circle."}
