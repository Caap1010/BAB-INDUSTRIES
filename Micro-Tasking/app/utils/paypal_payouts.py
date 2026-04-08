import uuid
from dataclasses import dataclass

import requests


class PayPalConfigurationError(RuntimeError):
    pass


class PayPalPayoutError(RuntimeError):
    pass


@dataclass
class PayPalPayoutResult:
    batch_id: str
    payout_item_id: str | None
    status: str
    message: str


@dataclass
class PayPalPayoutStatus:
    batch_id: str
    batch_status: str
    payout_item_id: str | None
    item_status: str | None
    message: str


def paypal_connection_status(config):
    client_id = config.get("PAYPAL_CLIENT_ID", "")
    client_secret = config.get("PAYPAL_CLIENT_SECRET", "")
    configured = bool(client_id and client_secret)
    return {
        "configured": configured,
        "environment": config.get("PAYPAL_ENVIRONMENT", "sandbox"),
        "api_base_url": config.get("PAYPAL_API_BASE_URL", ""),
        "payouts_web_url": config.get("PAYPAL_WEB_BASE_URL", ""),
    }


def _get_access_token(config):
    client_id = config.get("PAYPAL_CLIENT_ID", "")
    client_secret = config.get("PAYPAL_CLIENT_SECRET", "")
    api_base_url = config.get("PAYPAL_API_BASE_URL", "")

    if not client_id or not client_secret:
        raise PayPalConfigurationError("PayPal credentials are not configured.")

    response = requests.post(
        f"{api_base_url}/v1/oauth2/token",
        auth=(client_id, client_secret),
        headers={"Accept": "application/json"},
        data={"grant_type": "client_credentials"},
        timeout=30,
    )
    if response.status_code >= 400:
        raise PayPalPayoutError(f"PayPal auth failed: {response.status_code} {response.text[:300]}")

    payload = response.json()
    token = payload.get("access_token")
    if not token:
        raise PayPalPayoutError("PayPal auth succeeded but no access token was returned.")
    return token


def send_payout(config, *, recipient_email, amount, withdrawal_id, note=""):
    token = _get_access_token(config)
    api_base_url = config.get("PAYPAL_API_BASE_URL", "")
    sender_batch_id = f"mt-{withdrawal_id}-{uuid.uuid4().hex[:10]}"

    payload = {
        "sender_batch_header": {
            "sender_batch_id": sender_batch_id,
            "email_subject": "You have a payout",
            "email_message": "Your Micro-Tasking withdrawal has been submitted.",
        },
        "items": [
            {
                "recipient_type": "EMAIL",
                "amount": {
                    "value": f"{amount:.2f}",
                    "currency": "USD",
                },
                "receiver": recipient_email,
                "note": note or "Micro-Tasking withdrawal",
                "sender_item_id": f"withdrawal-{withdrawal_id}",
            }
        ],
    }

    response = requests.post(
        f"{api_base_url}/v1/payments/payouts",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if response.status_code >= 400:
        raise PayPalPayoutError(f"PayPal payout failed: {response.status_code} {response.text[:500]}")

    body = response.json()
    batch_header = body.get("batch_header", {})
    items = body.get("items") or []
    item = items[0] if items else {}

    return PayPalPayoutResult(
        batch_id=batch_header.get("payout_batch_id", sender_batch_id),
        payout_item_id=item.get("payout_item_id"),
        status=batch_header.get("batch_status", "SUCCESS"),
        message="Payout submitted to PayPal.",
    )


def fetch_payout_status(config, *, batch_id):
    token = _get_access_token(config)
    api_base_url = config.get("PAYPAL_API_BASE_URL", "")

    response = requests.get(
        f"{api_base_url}/v1/payments/payouts/{batch_id}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        timeout=30,
    )
    if response.status_code >= 400:
        raise PayPalPayoutError(f"PayPal payout status lookup failed: {response.status_code} {response.text[:500]}")

    body = response.json()
    batch_header = body.get("batch_header", {})
    items = body.get("items") or []
    item = items[0] if items else {}
    transaction_status = item.get("transaction_status") or {}
    errors = item.get("errors") or {}

    message = errors.get("message") or transaction_status.get("status") or batch_header.get("batch_status", "Unknown")

    return PayPalPayoutStatus(
        batch_id=batch_header.get("payout_batch_id", batch_id),
        batch_status=batch_header.get("batch_status", "UNKNOWN"),
        payout_item_id=item.get("payout_item_id"),
        item_status=transaction_status.get("status"),
        message=message,
    )