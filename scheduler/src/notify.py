"""Sends alerts via Firebase Cloud Messaging (push) and, for SOS
specifically, also Amazon SNS (SMS) for redundant delivery.
"""
import os
import boto3
import firebase_admin
from firebase_admin import credentials, messaging

_firebase_initialized = False


def _init_firebase():
    global _firebase_initialized
    if not _firebase_initialized:
        cred = credentials.Certificate(os.environ["FCM_CREDENTIALS_JSON"])
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True


def send_push(device_token: str, title: str, body: str) -> None:
    _init_firebase()
    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        token=device_token,
    )
    messaging.send(message)


def send_sms(phone_number: str, message: str) -> None:
    sns = boto3.client("sns", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
    sns.publish(PhoneNumber=phone_number, Message=message)


def send_sos(members: list[dict], circle_id: str) -> None:
    """Fires both push and SMS for every member who receives SOS alerts —
    intentionally redundant so a single channel failure can't cause a
    missed emergency alert.
    """
    for member in members:
        if member.get("device_token"):
            send_push(member["device_token"], "SOS Alert", "Emergency alert from your Care Circle")
        if member.get("phone_number"):
            send_sms(member["phone_number"], "SOS: Emergency alert from your Care Circle. Please check the app.")
