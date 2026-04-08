import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils.crypto import get_random_string


@dataclass
class ProviderFulfillmentError(Exception):
	message: str
	details: dict | None = None

	def __str__(self):
		return self.message


def _provider_slug(provider_name):
	return "".join(ch for ch in str(provider_name or "").strip().lower() if ch.isalnum() or ch in ("-", "_"))


def _get_integration(provider_slug):
	try:
		from .models import ProviderIntegration
	except Exception:
		return None
	return ProviderIntegration.objects.filter(provider_slug=provider_slug, is_active=True).first()


def _post_json(endpoint, payload, headers=None, timeout=25):
	headers = headers or {}
	body = json.dumps(payload).encode("utf-8")
	req = Request(endpoint, data=body, method="POST")
	req.add_header("Content-Type", "application/json")
	for key, value in headers.items():
		req.add_header(str(key), str(value))

	try:
		with urlopen(req, timeout=timeout) as response:
			raw = response.read().decode("utf-8")
			try:
				parsed = json.loads(raw) if raw else {}
			except json.JSONDecodeError:
				parsed = {"raw": raw}
			if response.status >= 400:
				raise ProviderFulfillmentError(
					f"Provider endpoint returned HTTP {response.status}.",
					details={"status": response.status, "response": parsed},
				)
			return parsed
	except HTTPError as exc:
		raw = exc.read().decode("utf-8", errors="ignore")
		raise ProviderFulfillmentError(
			f"Provider endpoint returned HTTP {exc.code}.",
			details={"status": exc.code, "response": raw},
		) from exc
	except URLError as exc:
		raise ProviderFulfillmentError(
			"Provider endpoint could not be reached.",
			details={"reason": str(exc.reason)},
		) from exc


def _mock_fulfillment(product, recipient_reference, quantity, reference):
	provider_key = "".join(ch for ch in str(product.provider or "").upper() if ch.isalnum())[:4] or "ITEM"
	fulfillment_code = f"{provider_key}-{get_random_string(8, allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789')}"
	details = {
		"provider": product.provider,
		"product": product.name,
		"reference": reference,
		"deliveryType": product.delivery_type,
		"recipientReference": recipient_reference,
		"quantity": quantity,
		"mode": "mock",
	}
	if product.delivery_type == "topup":
		details["message"] = f"Top-up request created for {recipient_reference or 'recipient'}"
	elif product.delivery_type == "pin":
		details["pin"] = f"PIN-{get_random_string(10, allowed_chars='23456789')}"
	else:
		details["voucherCode"] = fulfillment_code
	return {"status": "fulfilled", "fulfillmentCode": fulfillment_code, "details": details}


def _resolve_provider_config(product, provider_slug):
	product_metadata = product.metadata if isinstance(product.metadata, dict) else {}
	integration = _get_integration(provider_slug)
	endpoint_map = getattr(settings, "VOUCHER_PROVIDER_ENDPOINTS", {})
	api_key_map = getattr(settings, "VOUCHER_PROVIDER_API_KEYS", {})

	endpoint = str(
		product_metadata.get("providerEndpoint")
		or (integration.endpoint if integration and integration.endpoint else "")
		or endpoint_map.get(provider_slug)
		or ""
	).strip()
	api_key = str(
		product_metadata.get("providerApiKey")
		or (integration.api_key if integration and integration.api_key else "")
		or api_key_map.get(provider_slug)
		or ""
	).strip()
	mode = str(
		product_metadata.get("providerMode")
		or (integration.mode if integration else "")
		or ("live" if endpoint else "mock")
	).strip().lower()
	auth_scheme = str(
		product_metadata.get("providerAuthScheme")
		or (integration.auth_scheme if integration else "")
		or "bearer"
	).strip().lower()
	auth_header = str(
		product_metadata.get("providerAuthHeader")
		or (integration.auth_header if integration else "")
		or "Authorization"
	).strip()
	try:
		timeout = int(
			product_metadata.get("providerTimeout")
			or (integration.timeout_seconds if integration else 25)
			or 25
		)
	except (TypeError, ValueError):
		timeout = 25
	return {
		"integration": integration,
		"endpoint": endpoint,
		"apiKey": api_key,
		"mode": mode,
		"authScheme": auth_scheme,
		"authHeader": auth_header,
		"timeout": max(5, min(timeout, 90)),
	}


def fulfill_catalog_item(product, voucher_code, recipient_reference, quantity, reference, customer_name="", customer_email=""):
	provider_slug = _provider_slug(product.provider)
	config = _resolve_provider_config(product, provider_slug)
	endpoint = config["endpoint"]
	api_key = config["apiKey"]
	mode = config["mode"]

	if mode != "live" or not endpoint:
		return _mock_fulfillment(product, recipient_reference, quantity, reference)

	request_payload = {
		"provider": product.provider,
		"product": product.name,
		"productId": product.id,
		"voucherCode": voucher_code,
		"reference": reference,
		"recipientReference": recipient_reference,
		"quantity": quantity,
		"currency": product.currency,
		"unitPrice": str(product.sale_price),
		"customerName": customer_name,
		"customerEmail": customer_email,
	}
	headers = {}
	if api_key:
		if config["authScheme"] == "header":
			headers[config["authHeader"] or "X-API-Key"] = api_key
		elif config["authScheme"] == "bearer":
			headers[config["authHeader"] or "Authorization"] = f"Bearer {api_key}"
	headers["X-Provider-Slug"] = provider_slug
	headers["X-Idempotency-Key"] = reference or f"{voucher_code}-{product.id}-{quantity}"

	response_payload = _post_json(endpoint, request_payload, headers=headers, timeout=config["timeout"])
	success = bool(response_payload.get("ok", True))
	if not success:
		raise ProviderFulfillmentError(
			"Provider rejected fulfillment.",
			details={"response": response_payload},
		)

	fulfillment_code = str(response_payload.get("fulfillmentCode") or response_payload.get("voucherCode") or "").strip()
	if not fulfillment_code:
		fulfillment_code = f"{provider_slug.upper()[:4] or 'ITEM'}-{get_random_string(8, allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789')}"

	details = {
		"provider": product.provider,
		"product": product.name,
		"reference": reference,
		"deliveryType": product.delivery_type,
		"recipientReference": recipient_reference,
		"quantity": quantity,
		"mode": "live",
		"providerSlug": provider_slug,
		"integrationId": config["integration"].id if config.get("integration") else None,
		"providerResponse": response_payload,
	}
	return {"status": "fulfilled", "fulfillmentCode": fulfillment_code, "details": details}