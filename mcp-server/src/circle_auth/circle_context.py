from db.supabase_client import get_client


def get_user_circle_id(user_id: str) -> str:
    """Get the care circle for an authenticated user."""

    supabase = get_client()

    response = (
        supabase
        .table("circle_members")
        .select("circle_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            f"User {user_id} is not a member of any care circle."
        )

    return response.data[0]["circle_id"]