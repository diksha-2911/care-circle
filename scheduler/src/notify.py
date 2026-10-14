"""Send native device notifications through Firebase Cloud Messaging."""

import os
from typing import Optional

import firebase_admin
from firebase_admin import credentials, messaging

_firebase_initialized = False


def _init_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return

    credentials_path = os.environ.get("FCM_CREDENTIALS_PATH")
    if not credentials_path:
        raise RuntimeError("FCM_CREDENTIALS_PATH is not configured")

    cred = credentials.Certificate(credentials_path)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)
    _firebase_initialized = True


def send_push(
    device_token: str,
    title: str,
    body: str,
    data: Optional[dict[str, str]] = None,
) -> str:
    """Send a notification and return the FCM message ID.

    FCM data values must be strings. Do not include sensitive medical details
    in data payloads; use identifiers and let the authenticated app fetch data.
    """
    _init_firebase()
    payload = {str(key): str(value) for key, value in (data or {}).items()}
    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        token=device_token,
        data=payload or None,
        android=messaging.AndroidConfig(priority="high"),
        apns=messaging.APNSConfig(
            headers={"apns-priority": "10"},
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound="default", content_available=True)
            ),
        ),
    )
    response = messaging.send(message)
    print(f"Push notification accepted by FCM: {response}")
    return response


def is_invalid_device_token(error: Exception) -> bool:
    """Recognize errors that mean the token should be removed from Supabase."""
    code = getattr(error, "code", None)
    if callable(code):
        try:
            code = code()
        except Exception:
            code = None
    code_text = str(code or "").lower()
    class_name = error.__class__.__name__.lower()
    return (
        code_text in {
            "messaging/registration-token-not-registered",
            "messaging/invalid-registration-token",
            "registration-token-not-registered",
            "invalid-registration-token",
        }
        or class_name in {"unregisterederror", "invalidargumenterror"}
        and "token" in str(error).lower()
    )
