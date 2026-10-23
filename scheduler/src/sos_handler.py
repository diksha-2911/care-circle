"""HTTP Lambda for authenticated Care Circle SOS trigger/status/acknowledgement."""
import json
import os
import uuid
from datetime import datetime, timezone
from urllib.parse import unquote

import boto3
from supabase import create_client
from notify import send_push


def _db():
    return create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])


def _now():
    return datetime.now(timezone.utc).isoformat()


def _response(status, body):
    return {'statusCode': status, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': os.getenv('SOS_ALLOWED_ORIGIN', '*'), 'Access-Control-Allow-Headers': 'Authorization,Content-Type,Idempotency-Key', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'}, 'body': json.dumps(body, default=str)}


def _body(event):
    raw = event.get('body') or '{}'
    if event.get('isBase64Encoded'):
        import base64
        raw = base64.b64decode(raw).decode('utf-8')
    return json.loads(raw) if isinstance(raw, str) else raw


def _user_id(db, event):
    headers = {str(k).lower(): v for k, v in (event.get('headers') or {}).items()}
    auth = headers.get('authorization', '')
    if not auth.lower().startswith('bearer '):
        raise PermissionError('A valid Supabase bearer token is required.')
    token = auth.split(' ', 1)[1].strip()
    if not token:
        raise PermissionError('A valid Supabase bearer token is required.')
    try:
        response = db.auth.get_user(token)
        if not response or not response.user:
            raise ValueError('Invalid token')
        return str(response.user.id)
    except Exception as exc:
        raise PermissionError('Invalid or expired Supabase access token.') from exc


def _membership(db, circle_id, user_id, require_trigger=False):
    result = (db.table('circle_members').select('circle_id,user_id,role,can_trigger_sos,receives_sos_alerts')
              .eq('circle_id', circle_id).eq('user_id', user_id).limit(1).execute())
    if not result.data:
        raise PermissionError('You are not a member of this care circle.')
    member = result.data[0]
    if require_trigger and not member.get('can_trigger_sos'):
        raise PermissionError('You do not have permission to trigger SOS in this circle.')
    return member


def _send_sms(phone, message):
    # SMS is opt-in. Configure SOS_SMS_ENABLED=true and SOS_SNS_REGION before use.
    if os.getenv('SOS_SMS_ENABLED', 'false').lower() != 'true':
        raise RuntimeError('SMS delivery is not configured.')
    if not phone:
        raise RuntimeError('Recipient has no phone number registered.')
    client = boto3.client('sns', region_name=os.getenv('SOS_SNS_REGION') or os.getenv('AWS_REGION'))
    client.publish(PhoneNumber=phone, Message=message)


def _deliver(db, event_row, recipients):
    deliveries = []
    title = '🚨 Care Circle SOS'
    body = f"An SOS alert was triggered in {event_row.get('circle_name') or 'your care circle'}. Please check on the patient."
    for recipient in recipients:
        user_id = recipient['user_id']
        # Persist each channel attempt separately so partial success is visible.
        tokens_result = db.table('device_tokens').select('token').eq('user_id', user_id).execute()
        tokens = [r.get('token') for r in (tokens_result.data or []) if r.get('token')]
        if tokens:
            for token in tokens:
                row = {'event_id': event_row['id'], 'recipient_user_id': user_id, 'channel': 'push', 'status': 'processing', 'created_at': _now(), 'updated_at': _now()}
                created = db.table('sos_deliveries').insert(row).execute()
                delivery_id = created.data[0]['id'] if created.data else None
                try:
                    send_push(token, title, body)
                    update = {'status': 'sent', 'sent_at': _now(), 'updated_at': _now(), 'last_error': None}
                except Exception as exc:
                    update = {'status': 'failed', 'updated_at': _now(), 'last_error': str(exc)[:1000]}
                if delivery_id:
                    db.table('sos_deliveries').update(update).eq('id', delivery_id).execute()
                deliveries.append({'recipientUserId': user_id, 'channel': 'push', 'status': update['status']})
        else:
            db.table('sos_deliveries').insert({'event_id': event_row['id'], 'recipient_user_id': user_id, 'channel': 'push', 'status': 'failed', 'last_error': 'No registered device token', 'created_at': _now(), 'updated_at': _now()}).execute()
            deliveries.append({'recipientUserId': user_id, 'channel': 'push', 'status': 'failed'})

        # SMS is attempted only when explicitly enabled and a phone number exists.
        if os.getenv('SOS_SMS_ENABLED', 'false').lower() == 'true':
            profile = db.table('users').select('phone_number').eq('id', user_id).limit(1).execute()
            phone = profile.data[0].get('phone_number') if profile.data else None
            row = db.table('sos_deliveries').insert({'event_id': event_row['id'], 'recipient_user_id': user_id, 'channel': 'sms', 'status': 'processing', 'created_at': _now(), 'updated_at': _now()}).execute()
            delivery_id = row.data[0]['id'] if row.data else None
            try:
                _send_sms(phone, body)
                update = {'status': 'sent', 'sent_at': _now(), 'updated_at': _now(), 'last_error': None}
            except Exception as exc:
                update = {'status': 'failed', 'updated_at': _now(), 'last_error': str(exc)[:1000]}
            if delivery_id:
                db.table('sos_deliveries').update(update).eq('id', delivery_id).execute()
            deliveries.append({'recipientUserId': user_id, 'channel': 'sms', 'status': update['status']})
    return deliveries


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS' or event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return _response(204, {})
    try:
        db = _db()
        user_id = _user_id(db, event)
        method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method', 'POST')
        path = event.get('path') or event.get('rawPath') or '/sos'
        parts = [unquote(p) for p in path.strip('/').split('/') if p]

        # GET /sos/{eventId}
        if method == 'GET' and len(parts) == 2 and parts[0] == 'sos':
            event_id = parts[1]
            found = db.table('sos_events').select('*').eq('id', event_id).limit(1).execute()
            if not found.data:
                return _response(404, {'error': 'SOS event not found.'})
            sos = found.data[0]
            _membership(db, sos['circle_id'], user_id)
            deliveries = db.table('sos_deliveries').select('recipient_user_id,channel,status,last_error,sent_at').eq('event_id', event_id).execute()
            acknowledgements = db.table('sos_acknowledgements').select('user_id,acknowledged_at,note').eq('event_id', event_id).execute()
            return _response(200, {'eventId': event_id, 'status': sos['status'], 'message': 'SOS event status retrieved.', 'deliveries': deliveries.data or [], 'acknowledgements': acknowledgements.data or []})

        # POST /sos/{eventId}/acknowledge
        if method == 'POST' and len(parts) == 3 and parts[0] == 'sos' and parts[2] == 'acknowledge':
            event_id = parts[1]
            found = db.table('sos_events').select('id,circle_id,status').eq('id', event_id).limit(1).execute()
            if not found.data:
                return _response(404, {'error': 'SOS event not found.'})
            sos = found.data[0]
            _membership(db, sos['circle_id'], user_id)
            row = {'event_id': event_id, 'user_id': user_id, 'acknowledged_at': _now()}
            db.table('sos_acknowledgements').upsert(row, on_conflict='event_id,user_id').execute()
            db.table('sos_events').update({'status': 'acknowledged', 'updated_at': _now()}).eq('id', event_id).execute()
            return _response(200, {'eventId': event_id, 'acknowledgedAt': row['acknowledged_at'], 'message': 'SOS acknowledged.'})

        # POST /sos
        if method != 'POST' or parts not in (['sos'], []):
            return _response(404, {'error': 'Route not found.'})
        body = _body(event)
        circle_id = str(body.get('circleId') or '').strip()
        if not circle_id:
            return _response(400, {'error': 'circleId is required.'})
        member = _membership(db, circle_id, user_id, require_trigger=True)
        headers = {str(k).lower(): v for k, v in (event.get('headers') or {}).items()}
        idempotency_key = str(body.get('idempotencyKey') or headers.get('idempotency-key') or '').strip()
        if not idempotency_key:
            return _response(400, {'error': 'idempotencyKey is required.'})
        existing = db.table('sos_events').select('*').eq('triggered_by_user_id', user_id).eq('idempotency_key', idempotency_key).limit(1).execute()
        if existing.data:
            sos = existing.data[0]
            deliveries = db.table('sos_deliveries').select('recipient_user_id,channel,status').eq('event_id', sos['id']).execute()
            return _response(200, {'eventId': sos['id'], 'status': sos['status'], 'message': 'Existing SOS request returned (idempotent retry).', 'deliveries': deliveries.data or []})

        circle = db.table('care_circles').select('name').eq('id', circle_id).limit(1).execute()
        sos = {'circle_id': circle_id, 'triggered_by_user_id': user_id, 'status': 'processing', 'idempotency_key': idempotency_key, 'created_at': _now(), 'updated_at': _now()}
        created = db.table('sos_events').insert(sos).execute()
        if not created.data:
            return _response(500, {'error': 'SOS event could not be recorded.'})
        sos = created.data[0]
        sos['circle_name'] = circle.data[0]['name'] if circle.data else 'your care circle'
        recipient_result = db.table('circle_members').select('user_id').eq('circle_id', circle_id).eq('receives_sos_alerts', True).neq('user_id', user_id).execute()
        recipients = recipient_result.data or []
        if not recipients:
            db.table('sos_events').update({'status': 'no_recipients', 'updated_at': _now()}).eq('id', sos['id']).execute()
            return _response(200, {'eventId': sos['id'], 'status': 'no_recipients', 'message': 'SOS was recorded, but no other members are configured to receive alerts.', 'deliveries': []})
        try:
            deliveries = _deliver(db, sos, recipients)
        except Exception as exc:
            db.table('sos_events').update({'status': 'delivery_error', 'updated_at': _now(), 'last_error': str(exc)[:1000]}).eq('id', sos['id']).execute()
            return _response(200, {'eventId': sos['id'], 'status': 'delivery_error', 'message': 'SOS was recorded, but delivery processing encountered an error. Check event status.', 'error': str(exc)[:300]})
        successes = sum(1 for d in deliveries if d['status'] == 'sent')
        failures = len(deliveries) - successes
        status = 'sent' if successes and not failures else ('partially_sent' if successes else 'delivery_failed')
        db.table('sos_events').update({'status': status, 'updated_at': _now()}).eq('id', sos['id']).execute()
        return _response(200, {'eventId': sos['id'], 'status': status, 'message': f'SOS recorded. {successes} channel deliveries succeeded; {failures} failed.', 'deliveries': deliveries})
    except PermissionError as exc:
        return _response(401 if 'token' in str(exc).lower() else 403, {'error': str(exc)})
    except json.JSONDecodeError:
        return _response(400, {'error': 'Request body must be valid JSON.'})
    except Exception as exc:
        print(f'SOS handler failed: {exc}')
        return _response(500, {'error': 'Unexpected SOS processing error.'})
