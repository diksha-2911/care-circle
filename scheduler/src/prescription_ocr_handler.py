"""HTTP API Lambda for extracting text from prescription images with AWS Textract.

This endpoint never writes a prescription or creates medication alarms. The
mobile app displays the extracted text and suggested fields for user review.
"""
import base64
import json
import os
import re
from typing import Any

import boto3
from supabase import create_client

MAX_IMAGE_BYTES = 6 * 1024 * 1024
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/tiff"}


def _response(status: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": os.environ.get("OCR_ALLOWED_ORIGIN", "*"),
            "Access-Control-Allow-Headers": "Authorization,Content-Type",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def _body(event: dict[str, Any]) -> dict[str, Any]:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    return json.loads(raw) if isinstance(raw, str) else raw


def _token(event: dict[str, Any]) -> str | None:
    headers = event.get("headers") or {}
    auth = headers.get("authorization") or headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    return auth.split(" ", 1)[1].strip() or None


def _suggest_fields(text: str) -> tuple[dict[str, Any], list[str]]:
    """Conservative suggestions only; uncertain fields are intentionally null."""
    normalized = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    lower = normalized.lower()
    dosage_match = re.search(r"\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|g|ml|mL|iu|units?)\b", normalized, re.I)
    quantity_match = re.search(r"\b(?:qty|quantity|dispense|tab(?:lets?)?)\s*[:.-]?\s*(\d{1,3})\b", normalized, re.I)

    frequency = None
    frequency_patterns = [
        (r"\b(?:once|1\s*time)\s*(?:a|per)\s*day\b", 1),
        (r"\b(?:twice|2\s*times?)\s*(?:a|per)\s*day\b", 2),
        (r"\b(?:thrice|three\s*times?|3\s*times?)\s*(?:a|per)\s*day\b", 3),
        (r"\b(?:four|4)\s*times?\s*(?:a|per)\s*day\b", 4),
    ]
    for pattern, value in frequency_patterns:
        if re.search(pattern, lower):
            frequency = value
            break

    warnings = ["Review every field against the original prescription before saving."]
    if not dosage_match:
        warnings.append("Dosage was not confidently identified; enter it manually.")
    if frequency is None:
        warnings.append("Daily frequency was not confidently identified; enter it manually.")
    if not quantity_match:
        warnings.append("Quantity was not confidently identified; enter it manually.")
    # Textract detects text, not reliable medication semantics. Never guess a drug name
    # or convert shorthand such as 1-0-1 into a schedule automatically.
    return {
        "drug_name": None,
        "dosage": dosage_match.group(0).strip() if dosage_match else None,
        "frequency_per_day": frequency,
        "quantity_remaining": int(quantity_match.group(1)) if quantity_match else None,
        "alarm_times": [],
    }, warnings


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    method = ((event.get("requestContext") or {}).get("http") or {}).get("method")
    if method == "OPTIONS":
        return _response(204, {})
    if method and method != "POST":
        return _response(405, {"error": "Method not allowed."})

    token = _token(event)
    if not token:
        return _response(401, {"error": "A valid Supabase bearer token is required."})

    try:
        body = _body(event)
    except (ValueError, TypeError, json.JSONDecodeError):
        return _response(400, {"error": "Request body must be valid JSON."})

    circle_id = body.get("circleId")
    image_b64 = body.get("imageBase64")
    mime_type = (body.get("mimeType") or "image/jpeg").lower()
    if not isinstance(circle_id, str) or not circle_id.strip():
        return _response(400, {"error": "circleId is required."})
    if not isinstance(image_b64, str) or not image_b64:
        return _response(400, {"error": "imageBase64 is required."})
    if mime_type not in ALLOWED_MIME_TYPES:
        return _response(415, {"error": "Use a JPEG, PNG, or TIFF image."})

    try:
        image_bytes = base64.b64decode(image_b64, validate=True)
    except (ValueError, base64.binascii.Error):
        return _response(400, {"error": "Image data is not valid base64."})
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        return _response(413, {"error": "Image must be non-empty and no larger than 6 MB."})

    try:
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
        user_result = db.auth.get_user(token)
        user = getattr(user_result, "user", None)
        if user is None:
            return _response(401, {"error": "Your session is invalid or expired."})
        user_id = user.id

        membership = (
            db.table("circle_members")
            .select("id,can_manage_medications")
            .eq("circle_id", circle_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        member = membership.data
        if not member:
            return _response(403, {"error": "You are not a member of this care circle."})
        if not member.get("can_manage_medications"):
            return _response(403, {"error": "You do not have permission to scan prescriptions for this circle."})

        textract = boto3.client("textract", region_name=os.environ.get("AWS_REGION"))
        result = textract.detect_document_text(Document={"Bytes": image_bytes})
        lines = [block.get("Text", "") for block in result.get("Blocks", []) if block.get("BlockType") == "LINE"]
        extracted_text = "\n".join(line for line in lines if line).strip()
        if not extracted_text:
            return _response(422, {"error": "No readable text was found. Try a clearer, well-lit image."})

        suggestions, warnings = _suggest_fields(extracted_text)
        return _response(200, {
            "extractedText": extracted_text,
            "suggestions": suggestions,
            "warnings": warnings,
        })
    except Exception:
        # Avoid returning internal exceptions, tokens, or clinical data in logs/errors.
        print("Prescription OCR request failed.")
        return _response(500, {"error": "OCR processing failed. Please try again."})
