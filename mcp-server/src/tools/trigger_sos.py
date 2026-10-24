"""Trigger Care Circle SOS through the deployed SOS API."""

import os
import uuid

import requests


def trigger_sos(circle_id: str, access_token: str) -> dict:
    """Trigger SOS for a care circle using the authenticated user's token."""

    sos_api_url = os.environ.get("SOS_API_URL", "").strip()

    if not sos_api_url:
        raise RuntimeError(
            "SOS_API_URL must contain the deployed SOS API endpoint."
        )

    if not access_token:
        raise RuntimeError("Authenticated user's access token is required.")

    if not circle_id:
        raise RuntimeError("A valid circle ID is required.")

    # Use the same key in the request header and body.
    idempotency_key = str(uuid.uuid4())

    try:
        response = requests.post(
            sos_api_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Idempotency-Key": idempotency_key,
            },
            json={
                "circleId": circle_id,
                "idempotencyKey": idempotency_key,
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Could not reach the SOS API: {exc}"
        ) from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {"message": response.text}

    if not response.ok:
        raise RuntimeError(
            f"SOS API returned HTTP {response.status_code}: {payload}"
        )

    return payload