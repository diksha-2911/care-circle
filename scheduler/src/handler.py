"""AWS Lambda entrypoint, invoked on a schedule by EventBridge Scheduler
(see ../template.yaml). Checks for due doses, low-stock refills, and
upcoming appointments, then dispatches notifications for each.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

from check_due_doses import check_due_doses
from check_refills import check_refills
from check_appointments import check_appointments
from notify import send_push

load_dotenv()


def _get_db():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def lambda_handler(event, context):
    db = _get_db()

    alerts = []
    alerts += check_due_doses(db)
    alerts += check_refills(db)
    alerts += check_appointments(db)

    # TODO: look up device tokens/phone numbers per circle member and
    # route each alert through notify.send_push / notify.send_sms
    # accordingly. Left simple for the hackathon MVP — see notify.py
    # for the SOS path, which already does full push+SMS dispatch.

    return {"statusCode": 200, "alerts_found": len(alerts)}
