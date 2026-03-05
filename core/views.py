import json

from django.http import HttpResponseNotAllowed, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from .models import PestLead


def _client_ip(request):
	forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
	if forwarded_for:
		return forwarded_for.split(",")[0].strip()
	return request.META.get("REMOTE_ADDR")


@csrf_exempt
def create_pest_lead(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])

	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)

	name = str(payload.get("name", "")).strip()
	email = str(payload.get("email", "")).strip()
	subject = str(payload.get("subject", "")).strip()
	message = str(payload.get("message", "")).strip()
	request_type = str(payload.get("requestType", "")).strip()
	preferred_contact_time = str(payload.get("preferredContactTime", "")).strip()
	source = str(payload.get("source", "website")).strip()

	if not name or not email or not subject or not message:
		return JsonResponse(
			{"ok": False, "error": "Name, email, subject, and message are required."},
			status=400,
		)

	lead = PestLead.objects.create(
		name=name,
		email=email,
		subject=subject,
		message=message,
		request_type=request_type,
		preferred_contact_time=preferred_contact_time,
		source=source,
		ip_address=_client_ip(request),
		user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
	)

	return JsonResponse({"ok": True, "leadId": lead.id})


def pest_lead_list(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	leads = PestLead.objects.values(
		"id",
		"name",
		"email",
		"subject",
		"request_type",
		"preferred_contact_time",
		"source",
		"created_at",
	)[:300]
	return JsonResponse({"ok": True, "count": len(leads), "leads": list(leads)})


def pest_lead_dashboard(request):
	leads = PestLead.objects.all()[:300]
	return render(request, "core/pest_lead_dashboard.html", {"leads": leads})
