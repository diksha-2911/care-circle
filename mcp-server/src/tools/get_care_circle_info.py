"""MCP tool: retrieve care-circle information for the authenticated user."""

from db.supabase_client import get_client


def get_care_circle_info(user_id: str) -> dict:
    """
    If the user is a caregiver, list their care circles.
    If the user is a patient, list the members of their care circles.
    Supports users with different roles in different circles.
    """
    db = get_client()

    # Find only the circles the authenticated user belongs to.
    membership_response = (
        db.table("circle_members")
        .select("circle_id, role")
        .eq("user_id", user_id)
        .execute()
    )

    memberships = membership_response.data or []

    if not memberships:
        return {
            "status": "ok",
            "message": "You are not a member of any care circle.",
            "caregiver_circles": [],
            "patient_circles": [],
        }

    circle_ids = list(
        {membership["circle_id"] for membership in memberships}
    )

    # Retrieve information only for circles the user belongs to.
    circles_response = (
        db.table("care_circles")
        .select("id, name, patient_user_id")
        .in_("id", circle_ids)
        .execute()
    )

    circles = {
        circle["id"]: circle
        for circle in (circles_response.data or [])
    }

    caregiver_circles = []
    patient_circles = []

    # Build the response according to the user's role in each circle.
    for membership in memberships:
        circle_id = membership["circle_id"]
        role = membership["role"]
        circle = circles.get(circle_id)

        if not circle:
            continue

        if role == "caregiver":
            # Caregivers see the circles they belong to.
            patient_response = (
                db.table("users")
                .select("full_name")
                .eq("id", circle["patient_user_id"])
                .limit(1)
                .execute()
            )

            patient_name = (
                patient_response.data[0]["full_name"]
                if patient_response.data
                else "Unknown"
            )

            caregiver_circles.append({
                "circle_id": circle_id,
                "circle_name": circle["name"],
                "patient_name": patient_name,
            })

        elif role == "patient":
            # Patients see the members of their own care circle.
            members_response = (
                db.table("circle_members")
                .select("user_id, role")
                .eq("circle_id", circle_id)
                .execute()
            )

            circle_members = members_response.data or []
            member_ids = list({
                member["user_id"] for member in circle_members
            })

            users_by_id = {}

            if member_ids:
                users_response = (
                    db.table("users")
                    .select("id, full_name")
                    .in_("id", member_ids)
                    .execute()
                )

                users_by_id = {
                    user["id"]: user
                    for user in (users_response.data or [])
                }

            members = []

            for member in circle_members:
                user = users_by_id.get(member["user_id"])

                members.append({
                    "user_id": member["user_id"],
                    "name": (
                        user["full_name"]
                        if user
                        else "Unknown"
                    ),
                    "role": member["role"],
                })

            patient_circles.append({
                "circle_id": circle_id,
                "circle_name": circle["name"],
                "members": members,
            })

    return {
        "status": "ok",
        "caregiver_circles": caregiver_circles,
        "patient_circles": patient_circles,
    }