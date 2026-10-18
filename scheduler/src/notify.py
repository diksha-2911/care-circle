"""
Sends alerts through Firebase Cloud Messaging.
"""

import os

import firebase_admin
from firebase_admin import credentials, messaging


_firebase_initialized = False


def _init_firebase():
    global _firebase_initialized

    if _firebase_initialized:
        return

    credentials_path = os.environ["FCM_CREDENTIALS_PATH"]

    cred = credentials.Certificate(credentials_path)

    firebase_admin.initialize_app(cred)

    _firebase_initialized = True


def send_push(
    device_token: str,
    title: str,
    body: str,
) -> None:
    _init_firebase()

    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        token=device_token,
    )

    response = messaging.send(message)

    print(f"✅ Push notification sent: {response}")