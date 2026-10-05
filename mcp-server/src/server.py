"""Care Circle MCP server entrypoint.

Exposes medication/appointment/care-circle tools to Alexa+ over
Streamable HTTP, per MCP spec 2025-11-25.

Run locally:
    python src/server.py

"""
import os
from dotenv import load_dotenv
from fastmcp import FastMCP
from circle_auth.auth import SupabaseTokenVerifier

from tools.log_medication_taken import log_medication_taken
from tools.get_schedule import get_medication_schedule
from tools.get_upcoming_appointments import get_upcoming_appointments
from tools.get_refill_status import get_refill_status
from tools.add_care_note import add_care_note
from tools.trigger_sos import trigger_sos

from circle_auth.auth_context import get_authenticated_user_id
from circle_auth.circle_context import get_user_circle_id

load_dotenv()

auth = SupabaseTokenVerifier()
mcp = FastMCP("care-circle", auth=auth,)

def get_authenticated_circle():
    user_id = get_authenticated_user_id()
    circle_id = get_user_circle_id(user_id)

    return user_id, circle_id

@mcp.tool()
def log_medication(drug_name: str) -> dict:
    """Log a medication as taken for the authenticated user's care circle."""

    user_id, circle_id = get_authenticated_circle()

    return log_medication_taken(
        circle_id,
        drug_name,
        user_id,
    )


@mcp.tool()
def get_schedule() -> dict:
    """Get today's medication schedule for the authenticated user's care circle."""

    _, circle_id = get_authenticated_circle()

    return get_medication_schedule(circle_id)


@mcp.tool()
def get_appointments() -> dict:
    """Get upcoming appointments for the authenticated user's care circle."""

    _, circle_id = get_authenticated_circle()

    return get_upcoming_appointments(circle_id)


@mcp.tool()
def get_refills() -> dict:
    """Get medication refill status for the authenticated user's care circle."""

    _, circle_id = get_authenticated_circle()

    return get_refill_status(circle_id)


@mcp.tool()
def add_note(note: str) -> dict:
    """Add a care note to the authenticated user's care circle."""

    user_id, circle_id = get_authenticated_circle()

    return add_care_note(
        circle_id,
        user_id,
        note,
    )


@mcp.tool()
def sos() -> dict:
    """Trigger an SOS for the authenticated user's care circle."""

    user_id, circle_id = get_authenticated_circle()

    return trigger_sos(
        circle_id,
        user_id,
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    mcp.run(transport="streamable-http", port=port)
