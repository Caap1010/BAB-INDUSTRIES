import json
import os
from urllib.parse import urlencode
from urllib.request import urlopen

from django.http import HttpResponseNotAllowed, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from .models import PestLead, TrailerRecommendation

TMDB_BASE = "https://api.themoviedb.org/3"


def _tmdb_get(path, params=None):
	api_key = os.getenv("TMDB_API_KEY", "").strip()
	if not api_key:
		return None, {"ok": False, "error": "TMDB_API_KEY not configured on server."}, 503

	query_params = {"api_key": api_key, "language": "en-US"}
	if params:
		query_params.update({key: value for key, value in params.items() if value not in (None, "")})

	request_url = f"{TMDB_BASE}{path}?{urlencode(query_params)}"

	try:
		with urlopen(request_url, timeout=20) as response:
			payload = json.loads(response.read().decode("utf-8"))
			return payload, None, response.status
	except Exception as exc:
		return None, {"ok": False, "error": f"TMDB request failed: {str(exc)}"}, 502


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


def bab_watch_genres(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	media_type = request.GET.get("media_type", "movie")
	if media_type not in ("movie", "tv"):
		media_type = "movie"

	payload, error, status_code = _tmdb_get(f"/genre/{media_type}/list")
	if error:
		return JsonResponse(error, status=status_code)

	return JsonResponse({"ok": True, "genres": payload.get("genres", [])})


def bab_watch_providers(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	media_type = request.GET.get("media_type", "movie")
	region = request.GET.get("region", "ZA")
	if media_type not in ("movie", "tv"):
		media_type = "movie"

	payload, error, status_code = _tmdb_get(f"/watch/providers/{media_type}", {"watch_region": region})
	if error:
		return JsonResponse(error, status=status_code)

	return JsonResponse({"ok": True, "results": payload.get("results", [])})


def bab_watch_discover(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	media_type = request.GET.get("media_type", "movie")
	region = request.GET.get("region", "ZA")
	page = request.GET.get("page", "1")
	query = request.GET.get("query", "").strip()
	year = request.GET.get("year", "").strip()
	genre = request.GET.get("genre", "").strip()
	provider = request.GET.get("provider", "").strip()

	if media_type not in ("movie", "tv"):
		media_type = "movie"

	if query:
		payload, error, status_code = _tmdb_get(f"/search/{media_type}", {"query": query, "page": page})
	else:
		params = {
			"page": page,
			"watch_region": region,
			"with_genres": genre,
			"with_watch_providers": provider,
			"with_watch_monetization_types": "flatrate|rent|buy" if provider else "",
		}
		if media_type == "movie":
			params["primary_release_year"] = year
		else:
			params["first_air_date_year"] = year

		payload, error, status_code = _tmdb_get(f"/discover/{media_type}", params)

	if error:
		return JsonResponse(error, status=status_code)

	return JsonResponse(
		{
			"ok": True,
			"page": payload.get("page", 1),
			"total_pages": payload.get("total_pages", 1),
			"total_results": payload.get("total_results", 0),
			"results": payload.get("results", []),
		}
	)


def bab_watch_trending(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	region = request.GET.get("region", "ZA")

	movie_payload, movie_error, movie_status = _tmdb_get("/trending/movie/week")
	if movie_error:
		return JsonResponse(movie_error, status=movie_status)

	tv_payload, tv_error, tv_status = _tmdb_get("/trending/tv/week")
	if tv_error:
		return JsonResponse(tv_error, status=tv_status)

	cinema_payload, cinema_error, cinema_status = _tmdb_get("/movie/now_playing", {"region": region})
	if cinema_error:
		return JsonResponse(cinema_error, status=cinema_status)

	return JsonResponse(
		{
			"ok": True,
			"movies": movie_payload.get("results", []),
			"series": tv_payload.get("results", []),
			"cinema": cinema_payload.get("results", []),
		}
	)


def bab_watch_watch_link(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	media_type = request.GET.get("media_type", "movie")
	region = request.GET.get("region", "ZA")
	tmdb_id = request.GET.get("tmdb_id", "")

	if media_type not in ("movie", "tv"):
		media_type = "movie"

	if not tmdb_id:
		return JsonResponse({"ok": False, "error": "tmdb_id is required"}, status=400)

	payload, error, status_code = _tmdb_get(f"/{media_type}/{tmdb_id}/watch/providers")
	if error:
		return JsonResponse(error, status=status_code)

	region_data = payload.get("results", {}).get(region, {})
	return JsonResponse({"ok": True, "link": region_data.get("link", "")})


def bab_watch_trailer(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	media_type = request.GET.get("media_type", "movie")
	tmdb_id = request.GET.get("tmdb_id", "")

	if media_type not in ("movie", "tv"):
		media_type = "movie"

	if not tmdb_id:
		return JsonResponse({"ok": False, "error": "tmdb_id is required"}, status=400)

	payload, error, status_code = _tmdb_get(f"/{media_type}/{tmdb_id}/videos")
	if error:
		return JsonResponse(error, status=status_code)

	videos = payload.get("results", [])
	best_video = next(
		(
			video
			for video in videos
			if video.get("site") == "YouTube" and video.get("type") in ("Trailer", "Teaser")
		),
		None,
	)

	trailer_url = ""
	if best_video and best_video.get("key"):
		trailer_url = f"https://www.youtube.com/watch?v={best_video['key']}"

	return JsonResponse({"ok": True, "trailer": trailer_url})


@csrf_exempt
def bab_watch_recommendations(request):
	if request.method == "GET":
		items = TrailerRecommendation.objects.values(
			"id",
			"name",
			"title",
			"media_type",
			"recommendation",
			"trailer_url",
			"created_at",
		)[:250]
		return JsonResponse({"ok": True, "count": len(items), "items": list(items)})

	if request.method != "POST":
		return HttpResponseNotAllowed(["GET", "POST"])

	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)

	name = str(payload.get("name", "")).strip()
	title = str(payload.get("title", "")).strip()
	media_type = str(payload.get("mediaType", "movie")).strip().lower()
	recommendation = str(payload.get("recommendation", "")).strip()
	trailer_url = str(payload.get("trailerUrl", "")).strip()

	if media_type not in ("movie", "series", "anime"):
		media_type = "movie"

	if not name or not title or not recommendation:
		return JsonResponse(
			{"ok": False, "error": "Name, title, and recommendation are required."},
			status=400,
		)

	item = TrailerRecommendation.objects.create(
		name=name,
		title=title,
		media_type=media_type,
		recommendation=recommendation,
		trailer_url=trailer_url,
	)

	return JsonResponse({"ok": True, "id": item.id})
