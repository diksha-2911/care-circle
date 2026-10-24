"""MCP tool: create a doctor's appointment."""

from datetime import datetime, timezone

from db.supabase_client import get_client


def create_doctor_appointment(
    user_id: str,
    doctor_name: str,
    appointment_time: str,
    circle_id: str | None = None,
    location: str | None = None,
    notes: str | None = None,
) -> dict:
    """Create an appointment for a circle the authenticated user belongs to."""

    db = get_client()

    doctor_name = doctor_name.strip()

    if not doctor_name:
        raise ValueError("Doctor name cannot be empty.")

    # Resolve the circles the authenticated user belongs to.
    memberships_response = (
        db.table("circle_members")
        .select("circle_id, role, can_manage_medications")
        .eq("user_id", user_id)
        .execute()
    )

    memberships = memberships_response.data or []

    if not memberships:
        raise PermissionError(
            "You do not belong to any care circle."
        )

    # If no circle is specified, use it only when there is one unambiguous
    # choice. Never silently select the first circle for a multi-circle user.
    if circle_id is None:
        if len(memberships) != 1:
            raise ValueError(
                "You belong to multiple care circles. "
                "Please specify a circle_id from get_care_circle_info."
            )

        circle_id = memberships[0]["circle_id"]

    membership = next(
        (
            item for item in memberships
            if item["circle_id"] == circle_id
        ),
        None,
    )

    if membership is None:
        raise PermissionError(
            "You are not a member of the selected care circle."
        )

    if not membership["can_manage_medications"]:
        raise PermissionError(
            "You do not have permission to create appointments "
            "in this care circle."
        )

    # Require an explicit timezone, such as +05:30 or Z.
    try:
        parsed_time = datetime.fromisoformat(
            appointment_time.strip().replace("Z", "+00:00")
        )
    except (ValueError, AttributeError) as exc:
        raise ValueError(
            "Invalid appointment_time. Use ISO 8601 format, "
            "for example 2026-11-15T10:30:00+05:30."
        ) from exc

    if parsed_time.tzinfo is None or parsed_time.utcoffset() is None:
        raise ValueError(
            "appointment_time must include a timezone offset."
        )

    parsed_time = parsed_time.astimezone(timezone.utc)

    if parsed_time <= datetime.now(timezone.utc):
        raise ValueError(
            "Appointment time must be in the future."
        )

    # Persist the appointment using the existing schema.
    appointment_data = {
        "circle_id": circle_id,
        "doctor_name": doctor_name,
        "appointment_time": parsed_time.isoformat(),
        "location": location.strip() if location else None,
        "notes": notes.strip() if notes else None,
    }

    response = (
        db.table("appointments")
        .insert(appointment_data)
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            "The appointment could not be created."
        )

    appointment = response.data[0]

    return {
        "status": "ok",
        "message": "Doctor's appointment created successfully.",
        "appointment": appointment,
    }