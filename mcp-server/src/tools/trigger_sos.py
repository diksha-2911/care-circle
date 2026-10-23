"""MCP SOS tool: call the same authenticated SOS API used by the mobile app."""
import os
import requests


def trigger_sos(circle_id: str, triggered_by_user_id: str) -> dict:
    """Trigger SOS through the shared API.

    Configure SOS_API_URL and SOS_INTERNAL_TOKEN. The backend must validate this
    internal token separately from user bearer tokens and verify that the
    supplied user is authorized in the supplied circle. Do not expose this token
    to the mobile app or commit it to source control.
    """
    base_url = os.environ.get('SOS_API_URL', '').rstrip('/')
    internal_token = os.environ.get('SOS_INTERNAL_TOKEN', '')
    if not base_url or not internal_token:
        raise RuntimeError('SOS_API_URL and SOS_INTERNAL_TOKEN must be configured for MCP SOS.')
    response = requests.post(
        f'{base_url}/internal/sos',
        headers={'Authorization': f'Bearer {internal_token}', 'Content-Type': 'application/json'},
        json={'circleId': circle_id, 'triggeredByUserId': triggered_by_user_id},
        timeout=20,
    )
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if not response.ok:
        raise RuntimeError(payload.get('error') or f'SOS API failed with HTTP {response.status_code}.')
    return payload
