import json
import os
import random
import subprocess
import tempfile
import base64
import html
import re
from collections import Counter
from decimal import Decimal, InvalidOperation
from datetime import timedelta
from pathlib import Path
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
import requests

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.http import FileResponse, Http404, HttpResponseNotAllowed, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.views.decorators.csrf import csrf_exempt

from market_analysis.market_analysis import (
	MARKET_UNIVERSE,
	MarketDataError,
	analyze_candles,
	analyze_market_symbol,
	fetch_candles_from_provider,
)
from market_analysis.market_providers import get_supported_providers
from .models import (
	AdaptiveTradingPolicy,
	AlertDeliveryLog,
	MarketPrediction,
	MerchantPartner,
	PaperTradingAccount,
	PestLead,
	ProviderIntegration,
	ProviderHealthEvent,
	ProviderWebhookEvent,
	TradeLearningSnapshot,
	TrailerRecommendation,
	Voucher,
	VoucherCatalogItem,
	VoucherPurchase,
	VoucherRedemption,
)
from .voucher_provider_gateway import ProviderFulfillmentError, fulfill_catalog_item

TMDB_BASE = "https://api.themoviedb.org/3"
_CAP_MEDIA_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,120}$")


def _cap_media_root(kind):
	base_root = Path(getattr(settings, "CAP_ANIME_MEDIA_ROOT", settings.BASE_DIR / "generated_media" / "cap_anime"))
	kind_safe = "videos" if str(kind or "").lower().startswith("video") else "images"
	root = base_root / kind_safe
	root.mkdir(parents=True, exist_ok=True)
	return root


def _cap_media_url(kind, filename):
	group = "videos" if str(kind or "").lower().startswith("video") else "images"
	return f"/api/cap-anime/media/{group}/{filename}"


def _split_data_url(data_url):
	text = str(data_url or "")
	if not text.startswith("data:") or "," not in text:
		return None, None
	header, encoded = text.split(",", 1)
	if ";base64" not in header:
		return None, None
	mime = header[5:].split(";", 1)[0].strip().lower()
	if not mime:
		return None, None
	try:
		return mime, base64.b64decode(encoded, validate=True)
	except Exception:
		return None, None


def _mime_extension(mime, fallback):
	map_ext = {
		"image/png": "png",
		"image/jpeg": "jpg",
		"image/webp": "webp",
		"image/svg+xml": "svg",
		"video/webm": "webm",
		"video/mp4": "mp4",
	}
	return map_ext.get(str(mime or "").lower(), fallback)


def _save_cap_media_bytes(content, kind, extension, prefix):
	if not content:
		return None
	ext = str(extension or "bin").lower().strip(".") or "bin"
	name = f"{prefix}-{uuid4().hex[:18]}.{ext}"
	path = _cap_media_root(kind) / name
	path.write_bytes(content)
	return {
		"name": name,
		"path": str(path),
		"url": _cap_media_url(kind, name),
	}


def _save_cap_media_data_url(data_url, kind, fallback_ext, prefix):
	mime, content = _split_data_url(data_url)
	if not content:
		return None
	ext = _mime_extension(mime, fallback_ext)
	return _save_cap_media_bytes(content, kind, ext, prefix)


def _fetch_binary(url, timeout=60):
	try:
		res = requests.get(
			str(url),
			headers={
				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)",
				"Accept": "video/*,image/*,*/*;q=0.8",
			},
			timeout=timeout,
		)
		if res.status_code >= 400:
			return None, None, {"ok": False, "error": f"Provider HTTP {res.status_code}"}, 502
		content = res.content
		if not content:
			return None, None, {"ok": False, "error": "Provider returned empty body."}, 502
		content_type = (res.headers.get("Content-Type") or "application/octet-stream").split(";", 1)[0].strip().lower()
		return content, content_type, None, 200
	except Exception as exc:
		return None, None, {"ok": False, "error": f"Provider request failed: {str(exc)}"}, 502


def _ffmpeg_available():
	try:
		probe = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, check=False)
		return probe.returncode == 0
	except Exception:
		return False


def _create_local_video_from_image_data_url(image_data_url, duration_sec):
	mime, image_bytes = _split_data_url(image_data_url)
	if not image_bytes:
		return None, {"ok": False, "error": "Cannot create fallback video: invalid image payload."}, 502
	if not _ffmpeg_available():
		return None, {"ok": False, "error": "Video provider unavailable and ffmpeg is not installed for fallback rendering."}, 503

	duration = max(2, min(120, int(float(duration_sec or 8))))
	image_ext = _mime_extension(mime, "png")
	try:
		with tempfile.TemporaryDirectory() as tmp:
			input_path = Path(tmp) / f"frame.{image_ext}"
			output_path = Path(tmp) / "clip.webm"
			input_path.write_bytes(image_bytes)

			fade_out_start = max(0.5, duration - 1.2)
			vf_filter = (
				"scale=1280:720:force_original_aspect_ratio=decrease,"
				"pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,"
				"zoompan=z='min(zoom+0.0005,1.3)':x='iw/2-(iw/zoom/2)+sin(on/40)*8':y='ih/2-(ih/zoom/2)+cos(on/55)*6':d=1:s=1280x720:fps=24,"
				"fade=t=in:st=0:d=0.6,"
				f"fade=t=out:st={fade_out_start:.2f}:d=0.8"
			)
			cmd = [
				"ffmpeg",
				"-y",
				"-loop",
				"1",
				"-i",
				str(input_path),
				"-t",
				str(duration),
				"-vf",
				vf_filter,
				"-an",
				"-c:v",
				"libvpx-vp9",
				"-b:v",
				"3M",
				"-crf",
				"22",
				"-deadline",
				"good",
				"-cpu-used",
				"2",
				"-pix_fmt",
				"yuv420p",
				str(output_path),
			]
			run = subprocess.run(cmd, capture_output=True, text=True, check=False)
			if run.returncode != 0 or not output_path.exists():
				return None, {"ok": False, "error": "ffmpeg fallback render failed."}, 502

			video_bytes = output_path.read_bytes()
			asset = _save_cap_media_bytes(video_bytes, "video", "webm", "cap-video")
			if not asset:
				return None, {"ok": False, "error": "Could not persist fallback video."}, 500
			return asset, None, 200
	except Exception as exc:
		return None, {"ok": False, "error": f"Fallback video render failed: {str(exc)}"}, 502


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


def _parse_json_body(request):
	try:
		return json.loads(request.body.decode("utf-8")), None
	except (json.JSONDecodeError, UnicodeDecodeError):
		return None, JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)


def _post_json(url, payload, timeout=20):
	body = json.dumps(payload).encode("utf-8")
	req = Request(
		url,
		data=body,
		headers={"Content-Type": "application/json"},
		method="POST",
	)
	try:
		with urlopen(req, timeout=timeout) as response:
			raw = response.read().decode("utf-8")
			if not raw:
				return {"ok": response.status < 400}, response.status
			try:
				return json.loads(raw), response.status
			except json.JSONDecodeError:
				return {"ok": response.status < 400, "raw": raw}, response.status
	except Exception as exc:
		return {"ok": False, "error": f"Upstream request failed: {str(exc)}"}, 502


def _fetch_image_data_url(url, timeout=45):
	def _encode_image(body, content_type):
		import base64

		encoded = base64.b64encode(body).decode("ascii")
		return f"data:{content_type};base64,{encoded}", None, 200

	def _curl_fetch():
		try:
			with tempfile.NamedTemporaryFile(delete=True) as body_file, tempfile.NamedTemporaryFile(mode="w+b", delete=True) as header_file:
				cmd = [
					"curl",
					"-sS",
					"-L",
					"--max-time",
					str(int(timeout)),
					"-A",
					"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
					"-H",
					"Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
					"-D",
					header_file.name,
					"-o",
					body_file.name,
					url,
				]
				run = subprocess.run(cmd, capture_output=True, text=True, check=False)
				if run.returncode != 0:
					return None, {"ok": False, "error": f"curl failed: {run.stderr.strip()[:180]}"}, 502

				header_file.seek(0)
				headers_text = header_file.read().decode("utf-8", errors="ignore")
				status = 0
				content_type = ""
				for line in headers_text.splitlines():
					line = line.strip()
					if line.lower().startswith("http/"):
						parts = line.split()
						if len(parts) >= 2 and parts[1].isdigit():
							status = int(parts[1])
					if line.lower().startswith("content-type:"):
						content_type = line.split(":", 1)[1].strip().lower()

				body_file.seek(0)
				body = body_file.read()
				if status >= 400:
					return None, {"ok": False, "error": f"Provider HTTP {status}"}, 502
				if not body:
					return None, {"ok": False, "error": "Provider returned empty body."}, 502
				if not content_type.startswith("image/"):
					preview = body[:240].decode("utf-8", errors="ignore")
					return None, {"ok": False, "error": "Provider returned non-image payload.", "preview": preview}, 502

				return _encode_image(body, content_type)
		except Exception as exc:
			return None, {"ok": False, "error": f"curl fallback failed: {str(exc)}"}, 502

	headers = {
		"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
		"Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
	}
	try:
		response = requests.get(url, headers=headers, timeout=timeout)
		if response.status_code >= 400:
			if "image.pollinations.ai" in url:
				return _curl_fetch()
			return None, {"ok": False, "error": f"Provider HTTP {response.status_code}"}, 502

		content_type = (response.headers.get("Content-Type") or "").lower()
		body = response.content
		if not body:
			return None, {"ok": False, "error": "Provider returned empty body."}, 502
		if not content_type.startswith("image/"):
			if "image.pollinations.ai" in url:
				return _curl_fetch()
			preview = body[:240].decode("utf-8", errors="ignore")
			return None, {
				"ok": False,
				"error": "Provider returned non-image payload.",
				"preview": preview,
			}, 502
		return _encode_image(body, content_type)
	except HTTPError as exc:
		if "image.pollinations.ai" in url:
			return _curl_fetch()
		return None, {"ok": False, "error": f"Provider HTTP {exc.code}"}, 502
	except URLError as exc:
		if "image.pollinations.ai" in url:
			return _curl_fetch()
		return None, {"ok": False, "error": f"Provider network error: {str(exc.reason)}"}, 502
	except requests.RequestException as exc:
		if "image.pollinations.ai" in url:
			return _curl_fetch()
		return None, {"ok": False, "error": f"Provider request failed: {str(exc)}"}, 502
	except Exception as exc:
		if "image.pollinations.ai" in url:
			return _curl_fetch()
		return None, {"ok": False, "error": f"Provider request failed: {str(exc)}"}, 502


def _pollinations_image(prompt, width, height, seed, model):
	prompt_text = str(prompt or "character concept").strip()
	if not prompt_text:
		return None, {"ok": False, "error": "Prompt is required."}, 400
	prompt_text = prompt_text.replace("\n", " ").strip()[:260]

	seed_value = int(seed or 0) if str(seed or "").strip() else random.randint(1, 9_999_999)
	seed_value = abs(seed_value) % 9_999_999
	if seed_value == 0:
		seed_value = 1
	model_value = str(model or "flux").strip().lower() or "flux"
	last_error_payload = {"ok": False, "error": "Unknown provider error."}
	last_status = 502

	base_query = {
		"width": int(width),
		"height": int(height),
		"nologo": "true",
	}

	variants = [
		{"prompt": prompt_text, "query": {**base_query, "model": model_value, "enhance": "true"}, "with_seed": True},
		{"prompt": prompt_text, "query": {**base_query, "model": model_value}, "with_seed": True},
		{"prompt": prompt_text, "query": dict(base_query), "with_seed": True},
		{"prompt": prompt_text, "query": {**base_query, "model": model_value}, "with_seed": False},
		{"prompt": prompt_text, "query": dict(base_query), "with_seed": False},
	]

	for attempt in range(10):
		for variant in variants:
			query = dict(variant["query"])
			if variant.get("with_seed"):
				query["seed"] = random.randint(1, 9_999_999) if attempt > 0 else seed_value
			prompt_path = quote(str(variant["prompt"]), safe="")
			url = f"https://image.pollinations.ai/prompt/{prompt_path}?{urlencode(query)}"
			data_url, error_payload, status = _fetch_image_data_url(url)
			if data_url:
				return data_url, None, 200
			last_error_payload = error_payload or last_error_payload
			last_status = status or last_status

	return None, {
		"ok": False,
		"error": "All image provider attempts failed.",
		"details": last_error_payload,
	}, last_status


def _azure_image_size(width, height):
	width = int(width or 1024)
	height = int(height or 1024)
	if width == height:
		return "1024x1024"
	if width > height:
		return "1792x1024"
	return "1024x1792"


def _azure_openai_image(prompt, width, height):
	endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip().rstrip("/")
	api_key = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
	deployment = os.getenv("AZURE_OPENAI_IMAGE_DEPLOYMENT", "").strip()
	api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01").strip() or "2024-02-01"

	if not endpoint or not api_key or not deployment:
		return None, {"ok": False, "error": "Azure OpenAI image provider not configured."}, 503

	url = (
		f"{endpoint}/openai/deployments/{deployment}/images/generations"
		f"?api-version={quote(api_version, safe='')}"
	)
	payload = {
		"prompt": str(prompt or "").strip(),
		"n": 1,
		"size": _azure_image_size(width, height),
	}
	body = json.dumps(payload).encode("utf-8")
	request = Request(
		url,
		data=body,
		headers={
			"Content-Type": "application/json",
			"api-key": api_key,
		},
		method="POST",
	)

	try:
		with urlopen(request, timeout=60) as response:
			raw = response.read().decode("utf-8")
			parsed = json.loads(raw) if raw else {}
			items = parsed.get("data") if isinstance(parsed, dict) else None
			if not items:
				return None, {"ok": False, "error": "Azure returned empty image payload."}, 502

			item = items[0] if isinstance(items, list) and items else {}
			b64 = item.get("b64_json") if isinstance(item, dict) else None
			if b64:
				return f"data:image/png;base64,{b64}", None, 200

			image_url = item.get("url") if isinstance(item, dict) else None
			if image_url:
				return _fetch_image_data_url(str(image_url), timeout=60)

			return None, {"ok": False, "error": "Azure returned unsupported image format."}, 502
	except HTTPError as exc:
		message = f"Azure OpenAI HTTP {exc.code}"
		try:
			body = exc.read().decode("utf-8")
			if body:
				message = f"{message}: {body[:260]}"
		except Exception:
			pass
		return None, {"ok": False, "error": message}, 502
	except URLError as exc:
		return None, {"ok": False, "error": f"Azure network error: {str(exc.reason)}"}, 502
	except Exception as exc:
		return None, {"ok": False, "error": f"Azure request failed: {str(exc)}"}, 502


# ── Prompt enhancement & LLM helpers ─────────────────────────────────────────

_ANIME_STYLE_TAGS = [
	"anime art style", "hand-drawn animation", "cinematic lighting",
	"dramatic composition", "vibrant color palette", "highly detailed background",
	"sharp focus", "expressive character design", "dynamic camera angle", "cel-shaded",
]

_GENRE_TAGS = {
	"action": ["intense motion blur", "power aura", "battle-worn environment", "dramatic shadows"],
	"romance": ["soft warm lighting", "cherry blossoms", "pastel tones", "tender expression"],
	"horror": ["dark desaturated palette", "eerie shadows", "unsettling composition", "fog"],
	"fantasy": ["magical particles", "ethereal glow", "mystical atmosphere", "intricate architecture"],
	"scifi": ["neon lighting", "cyberpunk aesthetic", "holographic displays", "futuristic cityscape"],
	"slice of life": ["natural lighting", "cozy atmosphere", "everyday setting", "warm color palette"],
}


def _rule_enhance_prompt(prompt, style="anime"):
	"""Rule-based prompt enhancer — adds anime art-direction terms with no API call required."""
	text = str(prompt or "").strip()
	if not text:
		return text
	if text.lower().startswith("create an image that matches this description exactly:"):
		return text[:420]
	base_tags = ", ".join(_ANIME_STYLE_TAGS[:6])
	prompt_lower = text.lower()
	extra = []
	for genre, tags in _GENRE_TAGS.items():
		if genre in prompt_lower:
			extra.extend(tags[:2])
	suffix = (", " + ", ".join(extra)) if extra else ""
	return f"{text}, {base_tags}{suffix}, professional anime key art, 8K ultra-high detail"


def _llm_chat(messages, max_tokens=512, temperature=0.7):
	"""Call OpenAI gpt-4o-mini then Anthropic claude-haiku as fallback. Returns text or None."""
	openai_key = os.getenv("OPENAI_API_KEY", "").strip()
	if openai_key:
		try:
			res = requests.post(
				"https://api.openai.com/v1/chat/completions",
				headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
				json={"model": "gpt-4o-mini", "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
				timeout=30,
			)
			if res.status_code == 200:
				content = res.json().get("choices", [{}])[0].get("message", {}).get("content", "")
				if content:
					return content.strip()
		except Exception:
			pass

	anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
	if anthropic_key:
		system_msg = ""
		anthropic_msgs = []
		for m in messages:
			role = m.get("role", "user")
			content = m.get("content", "")
			if role == "system":
				system_msg = content
			else:
				anthropic_msgs.append({"role": role, "content": content})
		try:
			body = {"model": "claude-haiku-20240307", "max_tokens": max_tokens, "messages": anthropic_msgs}
			if system_msg:
				body["system"] = system_msg
			res = requests.post(
				"https://api.anthropic.com/v1/messages",
				headers={"x-api-key": anthropic_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
				json=body,
				timeout=30,
			)
			if res.status_code == 200:
				blocks = res.json().get("content", [])
				text = " ".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
				if text:
					return text
		except Exception:
			pass

	return None


def _enhance_prompt(raw_prompt, style="anime"):
	"""Enhance a prompt with art-direction terms via LLM (if configured) or rule-based fallback."""
	text = str(raw_prompt or "").strip()
	if not text:
		return text
	llm_result = _llm_chat(
		[
			{
				"role": "system",
				"content": (
					"You are an expert anime art director and prompt engineer. "
					"Given a user's animation concept, rewrite it as a rich, specific visual prompt "
					"for an AI image generator. Include: art style, lighting, composition, "
					"color palette, mood, and environmental detail. "
					"Output ONLY the enhanced prompt — no explanation, no preamble. "
					"Stay under 380 characters."
				),
			},
			{"role": "user", "content": f"Animation concept: {text}"},
		],
		max_tokens=200,
		temperature=0.6,
	)
	if llm_result:
		return llm_result
	return _rule_enhance_prompt(text, style=style)


def _local_svg_image_data_url(prompt, width, height, seed):
	"""Generate a deterministic local SVG image data URL when providers are unavailable."""
	w = max(256, min(1792, int(width or 1024)))
	h = max(256, min(1792, int(height or 1024)))
	seed_text = f"{prompt}|{seed}|{w}x{h}"
	seed_hash = abs(hash(seed_text))

	def _hex(v):
		return f"#{v & 0xFFFFFF:06x}"

	c1 = _hex(seed_hash)
	c2 = _hex(seed_hash >> 8)
	c3 = _hex(seed_hash >> 16)
	text = html.escape(str(prompt or "AI concept").strip()[:96] or "AI concept")
	x1 = 10 + (seed_hash % 80)
	x2 = 20 + ((seed_hash >> 7) % 70)

	svg = (
		f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">' 
		f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
		f'<stop offset="0%" stop-color="{c1}"/><stop offset="55%" stop-color="{c2}"/><stop offset="100%" stop-color="{c3}"/>'
		f'</linearGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="{(seed_hash % 997) + 1}"/><feColorMatrix type="saturate" values="0.15"/></filter></defs>'
		f'<rect width="100%" height="100%" fill="url(#g)"/>'
		f'<rect width="100%" height="100%" opacity="0.16" filter="url(#n)"/>'
		f'<circle cx="{int(w * x1 / 100)}" cy="{int(h * x2 / 100)}" r="{max(60, int(min(w, h) * 0.18))}" fill="#ffffff" opacity="0.14"/>'
		f'<text x="50%" y="86%" text-anchor="middle" font-family="system-ui,Segoe UI,Arial" font-size="{max(18, int(min(w, h) * 0.03))}" fill="#ffffff" opacity="0.92">{text}</text>'
		f'</svg>'
	)
	encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
	return f"data:image/svg+xml;base64,{encoded}"


def _openai_dalle3_image(prompt, width, height):
	"""Generate an image via OpenAI DALL-E 3. Returns (data_url, error, status)."""
	api_key = os.getenv("OPENAI_API_KEY", "").strip()
	if not api_key:
		return None, {"ok": False, "error": "OPENAI_API_KEY not configured."}, 503
	w, h = int(width or 1024), int(height or 1024)
	if w == h:
		size = "1024x1024"
	elif w > h:
		size = "1792x1024"
	else:
		size = "1024x1792"
	try:
		res = requests.post(
			"https://api.openai.com/v1/images/generations",
			headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
			json={"model": "dall-e-3", "prompt": str(prompt)[:4000], "n": 1, "size": size, "quality": "hd", "response_format": "b64_json"},
			timeout=90,
		)
		if res.status_code != 200:
			return None, {"ok": False, "error": f"DALL-E 3 HTTP {res.status_code}: {res.text[:200]}"}, 502
		b64 = (res.json().get("data") or [{}])[0].get("b64_json", "")
		if not b64:
			return None, {"ok": False, "error": "DALL-E 3 returned no image data."}, 502
		return f"data:image/png;base64,{b64}", None, 200
	except Exception as exc:
		return None, {"ok": False, "error": f"DALL-E 3 request failed: {str(exc)}"}, 502


def _stability_sdxl_image(prompt, width, height, seed):
	"""Generate an image via Stability AI SDXL 1024. Returns (data_url, error, status)."""
	api_key = os.getenv("STABILITY_API_KEY", "").strip()
	if not api_key:
		return None, {"ok": False, "error": "STABILITY_API_KEY not configured."}, 503
	seed_value = abs(int(seed or 0)) % 4294967295
	w, h = int(width or 1024), int(height or 1024)
	aspect_ratio = w / h if h else 1
	if aspect_ratio > 1.4:
		sdxl_w, sdxl_h = 1344, 768
	elif aspect_ratio < 0.75:
		sdxl_w, sdxl_h = 768, 1344
	else:
		sdxl_w, sdxl_h = 1024, 1024
	try:
		res = requests.post(
			"https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
			headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "Accept": "application/json"},
			json={
				"text_prompts": [{"text": str(prompt)[:2000], "weight": 1.0}],
				"cfg_scale": 7,
				"width": sdxl_w,
				"height": sdxl_h,
				"steps": 30,
				"samples": 1,
				"seed": seed_value,
				"style_preset": "anime",
			},
			timeout=120,
		)
		if res.status_code != 200:
			return None, {"ok": False, "error": f"Stability AI HTTP {res.status_code}: {res.text[:200]}"}, 502
		artifacts = res.json().get("artifacts", [])
		if not artifacts:
			return None, {"ok": False, "error": "Stability AI returned no artifacts."}, 502
		b64 = artifacts[0].get("base64", "")
		if not b64:
			return None, {"ok": False, "error": "Stability AI returned empty image."}, 502
		return f"data:image/png;base64,{b64}", None, 200
	except Exception as exc:
		return None, {"ok": False, "error": f"Stability AI request failed: {str(exc)}"}, 502


@csrf_exempt
def cap_anime_generate_image(request):
	if request.method not in ["POST", "OPTIONS"]:
		return HttpResponseNotAllowed(["POST", "OPTIONS"])

	if request.method == "OPTIONS":
		return JsonResponse({"ok": True}, status=200)

	payload, error = _parse_json_body(request)
	if error:
		return error

	raw_prompt = str(payload.get("prompt", "")).strip()
	if not raw_prompt:
		return JsonResponse({"ok": False, "error": "Prompt is required."}, status=400)

	aspect = str(payload.get("aspect", "16:9"))
	if aspect == "1:1":
		width, height = 1024, 1024
	elif aspect == "9:16":
		width, height = 720, 1280
	else:
		width, height = 1280, 720

	model = str(payload.get("model", "dall-e-3")).strip().lower() or "dall-e-3"
	seed = payload.get("seed")
	provider = str(payload.get("provider", "auto")).strip().lower() or "auto"

	# Enhance the prompt with art-direction terms (uses LLM if keys set, otherwise rule-based)
	prompt = _enhance_prompt(raw_prompt)

	def _store_and_respond(data_url, source):
		stored = _save_cap_media_data_url(data_url, "image", "png", "cap-image")
		return JsonResponse(
			{
				"ok": True,
				"source": source,
				"image": data_url,
				"imageUrl": stored["url"] if stored else "",
				"model": model,
				"width": width,
				"height": height,
			},
			status=200,
		)

	# 1. DALL-E 3 (OpenAI) — highest quality
	if provider in ["auto", "dalle3", "openai"]:
		data_url, error_payload, status = _openai_dalle3_image(prompt, width, height)
		if data_url:
			return _store_and_respond(data_url, "dall-e-3")
		if provider in ["dalle3", "openai"]:
			return JsonResponse(error_payload or {"ok": False, "error": "DALL-E 3 generation failed."}, status=status or 502)

	# 2. Stable Diffusion XL (Stability AI)
	if provider in ["auto", "sdxl", "stability"]:
		data_url, error_payload, status = _stability_sdxl_image(prompt, width, height, seed)
		if data_url:
			return _store_and_respond(data_url, "sdxl")
		if provider in ["sdxl", "stability"]:
			return JsonResponse(error_payload or {"ok": False, "error": "SDXL generation failed."}, status=status or 502)

	# 3. Azure OpenAI
	if provider in ["auto", "azure"]:
		data_url, error_payload, status = _azure_openai_image(prompt, width, height)
		if data_url:
			return _store_and_respond(data_url, "azure-openai")
		if provider == "azure":
			return JsonResponse(error_payload or {"ok": False, "error": "Azure generation failed."}, status=status or 502)

	# 4. Pollinations — zero-config fallback (flux model)
	data_url, error_payload, status = _pollinations_image(raw_prompt, width, height, seed, "flux")
	if data_url:
		return _store_and_respond(data_url, "pollinations")

	# 5. Local deterministic fallback — guarantees image generation availability.
	local_data_url = _local_svg_image_data_url(raw_prompt, width, height, seed)
	if local_data_url:
		return _store_and_respond(local_data_url, "local-svg")

	return JsonResponse(error_payload or {"ok": False, "error": "All image providers failed."}, status=status or 502)


@csrf_exempt
def cap_anime_generate_video(request):
	if request.method not in ["POST", "OPTIONS"]:
		return HttpResponseNotAllowed(["POST", "OPTIONS"])

	if request.method == "OPTIONS":
		return JsonResponse({"ok": True}, status=200)

	payload, error = _parse_json_body(request)
	if error:
		return error

	raw_prompt = str(payload.get("prompt", "")).strip()
	if not raw_prompt:
		return JsonResponse({"ok": False, "error": "Prompt is required."}, status=400)
	prompt = _enhance_prompt(raw_prompt)

	aspect = str(payload.get("aspect", "16:9"))
	duration = max(2, min(120, int(float(payload.get("duration", 8) or 8))))
	model = str(payload.get("model", "flux")).strip().lower() or "flux"
	seed = payload.get("seed")
	provider = str(payload.get("provider", "auto")).strip().lower() or "auto"
	provider_url = os.getenv("AI_SUITE_VIDEO_URL", "").strip()

	if provider in ["auto", "provider"] and provider_url:
		provider_payload, status = _post_json(
			provider_url,
			{
				"prompt": prompt,
				"aspect": aspect,
				"duration": duration,
				"model": model,
				"seed": seed,
			},
			timeout=120,
		)
		if status < 400 and provider_payload.get("ok"):
			video_data_url = str(provider_payload.get("videoDataUrl") or "")
			video_base64 = str(provider_payload.get("videoBase64") or "")
			video_url = str(provider_payload.get("videoUrl") or "")
			thumb_data_url = str(provider_payload.get("thumbnailDataUrl") or "")

			stored_video = None
			if video_data_url:
				stored_video = _save_cap_media_data_url(video_data_url, "video", "webm", "cap-video")
			elif video_base64:
				try:
					decoded = base64.b64decode(video_base64, validate=True)
					stored_video = _save_cap_media_bytes(decoded, "video", "webm", "cap-video")
				except Exception:
					stored_video = None
			elif video_url:
				content, content_type, fetch_error, fetch_status = _fetch_binary(video_url, timeout=120)
				if content:
					ext = _mime_extension(content_type, "webm")
					stored_video = _save_cap_media_bytes(content, "video", ext, "cap-video")
				elif provider == "provider":
					return JsonResponse(fetch_error or {"ok": False, "error": "Video fetch failed."}, status=fetch_status or 502)

			if stored_video:
				stored_thumb = _save_cap_media_data_url(thumb_data_url, "image", "png", "cap-thumb") if thumb_data_url else None
				return JsonResponse(
					{
						"ok": True,
						"source": "provider",
						"videoUrl": stored_video["url"],
						"thumbnailUrl": stored_thumb["url"] if stored_thumb else "",
						"duration": duration,
						"model": model,
					},
					status=200,
				)

			if provider == "provider":
				return JsonResponse({"ok": False, "error": "Video provider response did not contain usable media."}, status=502)

	if provider == "provider":
		return JsonResponse({"ok": False, "error": "AI_SUITE_VIDEO_URL is not configured."}, status=503)

	image_data_url, image_error, image_status = _pollinations_image(prompt, 1280, 720, seed, model)
	if not image_data_url:
		return JsonResponse(
			image_error or {"ok": False, "error": "Unable to generate base frame for fallback video."},
			status=image_status or 502,
		)

	video_asset, video_error, video_status = _create_local_video_from_image_data_url(image_data_url, duration)
	if not video_asset:
		return JsonResponse(video_error or {"ok": False, "error": "Fallback video generation failed."}, status=video_status or 502)

	stored_thumb = _save_cap_media_data_url(image_data_url, "image", "png", "cap-thumb")
	return JsonResponse(
		{
			"ok": True,
			"source": "fallback",
			"videoUrl": video_asset["url"],
			"thumbnailUrl": stored_thumb["url"] if stored_thumb else "",
			"image": image_data_url,
			"duration": duration,
			"model": model,
		},
		status=200,
	)


def cap_anime_media_file(request, media_group, filename):
	group = str(media_group or "").strip().lower()
	if group not in ["images", "videos"]:
		raise Http404("Media group not found")
	name = str(filename or "").strip()
	if not _CAP_MEDIA_NAME_RE.match(name):
		raise Http404("Media file not found")
	path = _cap_media_root(group) / name
	if not path.exists() or not path.is_file():
		raise Http404("Media file not found")
	content_type = "video/webm" if group == "videos" and name.lower().endswith(".webm") else None
	if group == "videos" and name.lower().endswith(".mp4"):
		content_type = "video/mp4"
	if group == "images" and name.lower().endswith(".png"):
		content_type = "image/png"
	if group == "images" and name.lower().endswith(".jpg"):
		content_type = "image/jpeg"
	if group == "images" and name.lower().endswith(".jpeg"):
		content_type = "image/jpeg"
	if group == "images" and name.lower().endswith(".webp"):
		content_type = "image/webp"
	if group == "images" and name.lower().endswith(".svg"):
		content_type = "image/svg+xml"
	response = FileResponse(open(path, "rb"), content_type=content_type)
	response["Cache-Control"] = "public, max-age=604800"
	response["X-Content-Type-Options"] = "nosniff"
	return response


# ── AI Script generation ──────────────────────────────────────────────────

_SCRIPT_TEMPLATES = {
	"action": [
		"[NARRATOR]: A clash of fates was inevitable.",
		"{char1}: This ends now!",
		"{char2}: You think you can stop me?",
		"{char1}: I've trained my whole life for this moment.",
		"{char2}: Then show me everything you've got!",
		"[SCENE: Intense battle begins. Shockwaves crack the earth.]",
	],
	"romance": [
		"[SCENE: Sunset. Golden light. Both characters stand at the edge of a rooftop.]",
		"{char1}: I never knew how to say this to you.",
		"{char2}: Say what?",
		"{char1}: That you're the reason I keep going every single day.",
		"[BEAT: Silence. Wind stirs their hair.]",
		"{char2}: I feel exactly the same way.",
	],
	"fantasy": [
		"[NARRATOR]: In a realm where magic flows through all living things…",
		"{char1}: The prophecy is real. I can feel it in my blood.",
		"{char2}: Then we face our destiny together.",
		"{char1}: Are you certain you’re ready for what’s ahead?",
		"{char2}: I was born ready.",
		"[SCENE: The ancient gate begins to glow.]",
	],
	"horror": [
		"[NARRATOR]: Something was wrong. They could all feel it.",
		"{char1}: Did you hear that? Something’s out there.",
		"{char2}: Don’t open that door.",
		"{char1}: We have to. There’s no other way out.",
		"[SOUND: Slow, ominous footsteps grow closer.]",
		"{char2}: Whatever it is… it’s already inside.",
	],
	"scifi": [
		"[NARRATOR]: Year 2387. The last colony ship on record.",
		"{char1}: All systems nominal. Warp core charged.",
		"{char2}: Then get us out of here before the signal dies.",
		"{char1}: Coordinates locked. Taking us to the edge of the known universe.",
		"{char2}: Whatever’s out there… we’ll face it together.",
		"[SCENE: The ship jumps to warp. Stars streak into light.]",
	],
	"default": [
		"[NARRATOR]: The story begins.",
		"{char1}: Are you ready for this?",
		"{char2}: I’ve never been more ready in my life.",
		"[SCENE: The two protagonists set out on their journey.]",
		"{char1}: No matter what happens, we face it together.",
		"{char2}: Together.",
	],
}


def _template_anime_script(prompt, genre, tone, characters):
	genre_key = str(genre or "default").lower()
	matched = next((k for k in _SCRIPT_TEMPLATES if k in genre_key or genre_key in k), "default")
	lines = list(_SCRIPT_TEMPLATES[matched])
	char_names = [c.strip() for c in str(characters or "").split(",") if c.strip()]
	char1 = char_names[0] if len(char_names) > 0 else "Protagonist"
	char2 = char_names[1] if len(char_names) > 1 else "Antagonist"
	return "\n".join(line.replace("{char1}", char1).replace("{char2}", char2) for line in lines)


@csrf_exempt
def cap_anime_generate_script(request):
	if request.method not in ["POST", "OPTIONS"]:
		return HttpResponseNotAllowed(["POST", "OPTIONS"])
	if request.method == "OPTIONS":
		return JsonResponse({"ok": True}, status=200)
	payload, err = _parse_json_body(request)
	if err:
		return err

	prompt = str(payload.get("prompt", "")).strip()
	if not prompt:
		return JsonResponse({"ok": False, "error": "Prompt is required."}, status=400)

	genre = str(payload.get("genre", "action")).strip().lower() or "action"
	tone = str(payload.get("tone", "dramatic")).strip().lower() or "dramatic"
	characters = str(payload.get("characters", "")).strip()
	scenes = max(1, min(10, int(float(payload.get("scenes", 3) or 3))))

	llm_result = _llm_chat(
		[
			{
				"role": "system",
				"content": (
					"You are a professional anime screenwriter. Write a compelling, emotionally resonant anime script. "
					f"Genre: {genre}. Tone: {tone}. "
					f"Include {scenes} scene(s). Format each line as either: "
					"CHARACTER NAME: dialogue text, or [SCENE/ACTION/NARRATOR: description]. "
					"Characters must speak with authentic emotion and personality. No meta-commentary — just the script."
				),
			},
			{
				"role": "user",
				"content": (
					f"Write an anime script for: {prompt}"
					+ (f". Main characters: {characters}" if characters else "")
					+ f". Include {scenes} scene(s)."
				),
			},
		],
		max_tokens=900,
		temperature=0.78,
	)
	if llm_result:
		segments = [line.strip() for line in llm_result.split("\n") if line.strip()]
		return JsonResponse(
			{"ok": True, "source": "llm", "script": llm_result, "segments": segments, "genre": genre, "tone": tone},
			status=200,
		)

	script_text = _template_anime_script(prompt, genre, tone, characters)
	segments = [line.strip() for line in script_text.split("\n") if line.strip()]
	return JsonResponse(
		{"ok": True, "source": "template", "script": script_text, "segments": segments, "genre": genre, "tone": tone},
		status=200,
	)


def _local_prompt_moderation(prompt, mode="standard", blocked_terms=None):
	text = str(prompt or "").lower()
	provided = blocked_terms if isinstance(blocked_terms, list) else []
	provided = [str(term).strip().lower() for term in provided if str(term).strip()]
	strict_defaults = ["nudity", "sexual", "explicit", "gore", "violent assault", "hate symbol"]
	merged = provided + (strict_defaults if str(mode).lower() == "strict" else [])
	violations = [term for term in merged if term and term in text]
	return {
		"ok": True,
		"allowed": len(violations) == 0,
		"violations": violations,
		"mode": str(mode or "standard").lower(),
		"source": "local",
	}


def _seconds_to_srt_timestamp(value):
	seconds = max(0.0, float(value or 0))
	hours = int(seconds // 3600)
	minutes = int((seconds % 3600) // 60)
	whole_seconds = int(seconds % 60)
	millis = int(round((seconds - int(seconds)) * 1000))
	if millis >= 1000:
		whole_seconds += 1
		millis = 0
	return f"{hours:02}:{minutes:02}:{whole_seconds:02},{millis:03}"


def _build_dub_cues(script, duration_seconds):
	lines = [line.strip() for line in str(script or "").split("\n") if line.strip()]
	if not lines:
		return []
	count = len(lines)
	segment = max(0.1, float(duration_seconds or 0) / count)
	cues = []
	for idx, line in enumerate(lines):
		start = round(segment * idx, 3)
		end = round(segment * (idx + 1), 3)
		cues.append(
			{
				"index": idx + 1,
				"text": line,
				"start": start,
				"end": end,
				"duration": round(end - start, 3),
			}
		)
	return cues


def _build_srt_from_cues(cues):
	rows = []
	for cue in cues:
		rows.append(
			"\n".join(
				[
					str(cue.get("index", "")),
					f"{_seconds_to_srt_timestamp(cue.get('start', 0))} --> {_seconds_to_srt_timestamp(cue.get('end', 0))}",
					str(cue.get("text", "")),
				]
			)
		)
	return "\n\n".join(rows)


def _load_reviews_cache():
	reviews = cache.get("ai_suite_reviews_v1")
	if isinstance(reviews, list):
		return reviews
	return []


def _save_reviews_cache(reviews):
	cache.set("ai_suite_reviews_v1", reviews, timeout=60 * 60 * 24 * 14)


@csrf_exempt
def ai_suite_moderate(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])
	payload, error = _parse_json_body(request)
	if error:
		return error
	prompt = payload.get("prompt")
	mode = payload.get("mode", "standard")
	blocked_terms = payload.get("blockedTerms", [])

	provider_url = os.getenv("AI_SUITE_MODERATION_URL", "").strip()
	if provider_url:
		provider_payload, status = _post_json(
			provider_url,
			{
				"prompt": prompt,
				"mode": mode,
				"blockedTerms": blocked_terms,
			},
		)
		if provider_payload.get("ok"):
			provider_payload.setdefault("source", "provider")
			return JsonResponse(provider_payload, status=200)
		return JsonResponse(provider_payload, status=status)

	return JsonResponse(_local_prompt_moderation(prompt, mode=mode, blocked_terms=blocked_terms), status=200)


@csrf_exempt
def ai_suite_dub_cues(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])
	payload, error = _parse_json_body(request)
	if error:
		return error
	script = payload.get("script", "")
	language = str(payload.get("language", "en-US"))
	duration_seconds = float(payload.get("duration", 24) or 24)

	provider_url = os.getenv("AI_SUITE_DUB_URL", "").strip()
	if provider_url:
		provider_payload, status = _post_json(
			provider_url,
			{
				"script": script,
				"language": language,
				"duration": duration_seconds,
			},
		)
		if provider_payload.get("ok"):
			provider_payload.setdefault("source", "provider")
			return JsonResponse(provider_payload, status=200)

	# Try LLM for natural pacing and per-speaker timing
	llm_cues_json = _llm_chat(
		[
			{
				"role": "system",
				"content": (
					"You are an anime dubbing director. Given a script and total duration in seconds, "
					"output a JSON array of dub cue objects. Each object must have: "
					"'start' (float seconds), 'end' (float seconds), 'text' (string, spoken line only), 'speaker' (character name or 'narrator'). "
					"Skip scene directions ([...]) or convert them to brief pauses. "
					"Pace dialogue to sound natural with brief gaps between speakers. "
					f"Total duration: {duration_seconds:.1f}s. Output ONLY the JSON array, no markdown, no explanation."
				),
			},
			{"role": "user", "content": f"Script:\n{script}"},
		],
		max_tokens=700,
		temperature=0.3,
	)
	if llm_cues_json:
		try:
			json_text = llm_cues_json.strip()
			if "```" in json_text:
				parts = json_text.split("```")
				json_text = parts[1] if len(parts) > 1 else json_text
				if json_text.startswith("json"):
					json_text = json_text[4:]
			llm_cues = json.loads(json_text)
			if isinstance(llm_cues, list) and llm_cues:
				return JsonResponse(
					{"ok": True, "source": "llm", "language": language, "cues": llm_cues, "srt": _build_srt_from_cues(llm_cues)},
					status=200,
				)
		except Exception:
			pass

	cues = _build_dub_cues(script, duration_seconds)
	return JsonResponse(
		{
			"ok": True,
			"source": "local",
			"language": language,
			"cues": cues,
			"srt": _build_srt_from_cues(cues),
		},
		status=200,
	)


@csrf_exempt
def ai_suite_soundtrack(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])
	payload, error = _parse_json_body(request)
	if error:
		return error
	mood = str(payload.get("mood", "intense"))
	duration_seconds = float(payload.get("duration", 24) or 24)

	provider_url = os.getenv("AI_SUITE_SOUNDTRACK_URL", "").strip()
	if provider_url:
		provider_payload, status = _post_json(
			provider_url,
			{
				"mood": mood,
				"duration": duration_seconds,
			},
		)
		if provider_payload.get("ok"):
			provider_payload.setdefault("source", "provider")
			return JsonResponse(provider_payload, status=200)
		return JsonResponse(provider_payload, status=status)

	return JsonResponse(
		{
			"ok": True,
			"source": "local",
			"mood": mood,
			"duration": duration_seconds,
			"note": "No AI_SUITE_SOUNDTRACK_URL configured. Use client fallback synth or configure provider.",
		},
		status=200,
	)


@csrf_exempt
def ai_suite_review_submit(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])
	payload, error = _parse_json_body(request)
	if error:
		return error

	review = {
		"id": str(uuid4()),
		"workspace": str(payload.get("workspace", "default")),
		"notes": str(payload.get("notes", ""))[:800],
		"license": str(payload.get("license", "commercial")),
		"approved": False,
		"createdAt": timezone.now().isoformat(),
	}
	reviews = _load_reviews_cache()
	reviews.append(review)
	_save_reviews_cache(reviews)
	return JsonResponse({"ok": True, "review": review, "count": len(reviews)}, status=200)


@csrf_exempt
def ai_suite_review_approve(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])
	payload, error = _parse_json_body(request)
	if error:
		return error
	target_id = str(payload.get("id", "")).strip()
	reviews = _load_reviews_cache()
	if not reviews:
		return JsonResponse({"ok": False, "error": "No submitted reviews found."}, status=404)

	approved = None
	if target_id:
		for index, item in enumerate(reviews):
			if str(item.get("id", "")) == target_id:
				reviews[index]["approved"] = True
				reviews[index]["approvedAt"] = timezone.now().isoformat()
				approved = reviews[index]
				break
		if not approved:
			return JsonResponse({"ok": False, "error": "Review not found."}, status=404)
	else:
		reviews[-1]["approved"] = True
		reviews[-1]["approvedAt"] = timezone.now().isoformat()
		approved = reviews[-1]

	_save_reviews_cache(reviews)
	return JsonResponse({"ok": True, "review": approved}, status=200)


@csrf_exempt
def ai_suite_webhook_test(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])
	payload, error = _parse_json_body(request)
	if error:
		return error

	url = str(payload.get("url", "")).strip() or os.getenv("AI_SUITE_WEBHOOK_URL", "").strip()
	if not url:
		return JsonResponse({"ok": False, "error": "Webhook URL missing."}, status=400)

	body = {
		"event": payload.get("event", "test"),
		"at": timezone.now().isoformat(),
		"payload": payload.get("payload", {}),
	}
	result, status = _post_json(url, body)
	if status >= 400:
		return JsonResponse(result, status=status)
	return JsonResponse({"ok": True, "target": url, "response": result}, status=200)


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


def _parse_decimal(value, default="0"):
	try:
		if value in (None, ""):
			return Decimal(str(default))
		return Decimal(str(value))
	except (InvalidOperation, TypeError, ValueError):
		return Decimal(str(default))


def _normalize_channels(value):
	if not isinstance(value, list):
		return []
	channels = []
	for item in value:
		channel = str(item or "").strip().lower()
		if channel and channel not in channels:
			channels.append(channel)
	return channels


def _normalize_option_list(value):
	if not isinstance(value, list):
		return []
	items = []
	for item in value:
		normalized = str(item or "").strip().lower()
		if normalized and normalized not in items:
			items.append(normalized)
	return items


def _voucher_channel_allowed(voucher, channel):
	channel = str(channel or "").strip().lower()
	allowed_channels = _normalize_channels(voucher.allowed_channels)
	if voucher.is_global or not allowed_channels:
		return True
	return channel in allowed_channels


def _serialize_voucher(voucher, order_amount=None, channel=""):
	order_total = _parse_decimal(order_amount, default="0") if order_amount is not None else None
	discount_amount = voucher.compute_discount(order_total) if order_total is not None else None
	final_amount = None
	if order_total is not None and discount_amount is not None:
		final_amount = max(Decimal("0.00"), order_total - discount_amount)
	return {
		"id": voucher.id,
		"name": voucher.name,
		"code": voucher.code,
		"voucherKind": voucher.voucher_kind,
		"discountType": voucher.discount_type,
		"discountValue": str(voucher.discount_value),
		"initialBalance": str(voucher.initial_balance),
		"remainingBalance": str(voucher.remaining_balance),
		"currency": voucher.currency,
		"isGlobal": voucher.is_global,
		"allowedChannels": _normalize_channels(voucher.allowed_channels),
		"supportedCategories": _normalize_option_list(voucher.supported_categories),
		"supportedProviders": _normalize_option_list(voucher.supported_providers),
		"minOrderAmount": str(voucher.min_order_amount),
		"usageLimit": voucher.usage_limit,
		"usageCount": voucher.usage_count,
		"isActive": voucher.is_active,
		"activeFrom": voucher.active_from.isoformat() if voucher.active_from else None,
		"expiresAt": voucher.expires_at.isoformat() if voucher.expires_at else None,
		"notes": voucher.notes,
		"metadata": voucher.metadata or {},
		"createdAt": voucher.created_at.isoformat() if voucher.created_at else None,
		"updatedAt": voucher.updated_at.isoformat() if voucher.updated_at else None,
		"channelAccepted": _voucher_channel_allowed(voucher, channel),
		"discountAmount": str(discount_amount) if discount_amount is not None else None,
		"finalAmount": str(final_amount) if final_amount is not None else None,
	}


def _voucher_error(voucher, order_amount=None, channel=""):
	now = timezone.now()
	if not voucher.is_active:
		return "Voucher is inactive."
	if voucher.active_from and now < voucher.active_from:
		return "Voucher is not active yet."
	if voucher.expires_at and now > voucher.expires_at:
		return "Voucher has expired."
	if voucher.usage_limit and voucher.usage_count >= voucher.usage_limit:
		return "Voucher has reached its usage limit."
	if voucher.voucher_kind == Voucher.VoucherKind.STORED_VALUE and Decimal(str(voucher.remaining_balance or 0)) <= 0:
		return "Voucher balance is exhausted."
	if not _voucher_channel_allowed(voucher, channel):
		return "Voucher is not allowed on this channel."
	if order_amount is not None:
		order_total = _parse_decimal(order_amount, default="0")
		if order_total < voucher.min_order_amount:
			return f"Minimum order amount is {voucher.min_order_amount} {voucher.currency}."
	return None


def _voucher_code_alphabet(charset="alnum"):
	charset = str(charset or "alnum").strip().lower()
	if charset == "numeric":
		return "2345678901"
	if charset == "alpha":
		return "ABCDEFGHJKLMNPQRSTUVWXYZ"
	return "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_voucher_code(prefix="", length=10, charset="alnum", group_size=0, separator="-"):
	prefix = "".join(ch for ch in str(prefix or "").upper() if ch.isalnum())[:8]
	length = max(4, min(24, int(length or 10)))
	group_size = max(0, min(8, int(group_size or 0)))
	separator = str(separator or "-")[:1]
	allowed_chars = _voucher_code_alphabet(charset)
	for _ in range(20):
		body = get_random_string(length, allowed_chars=allowed_chars)
		if group_size:
			body = separator.join(body[index:index + group_size] for index in range(0, len(body), group_size))
		code = f"{prefix}{separator}{body}" if prefix else body
		if not Voucher.objects.filter(code=code).exists():
			return code
	raise RuntimeError("Unable to generate a unique voucher code.")


def _serialize_catalog_item(item):
	return {
		"id": item.id,
		"name": item.name,
		"provider": item.provider,
		"category": item.category,
		"deliveryType": item.delivery_type,
		"faceValue": str(item.face_value),
		"salePrice": str(item.sale_price),
		"currency": item.currency,
		"requiresRecipient": item.requires_recipient,
		"recipientLabel": item.recipient_label,
		"isActive": item.is_active,
		"notes": item.notes,
		"metadata": item.metadata or {},
	}


def _serialize_purchase(purchase):
	return {
		"id": purchase.id,
		"voucherCode": purchase.voucher.code,
		"productId": purchase.product_id,
		"productName": purchase.product.name,
		"provider": purchase.product.provider,
		"category": purchase.product.category,
		"reference": purchase.reference,
		"recipientReference": purchase.recipient_reference,
		"customerName": purchase.customer_name,
		"customerEmail": purchase.customer_email,
		"channel": purchase.channel,
		"quantity": purchase.quantity,
		"totalAmount": str(purchase.total_amount),
		"status": purchase.status,
		"fulfillmentCode": purchase.fulfillment_code,
		"fulfillmentDetails": purchase.fulfillment_details or {},
		"createdAt": purchase.created_at.isoformat() if purchase.created_at else None,
	}


def _serialize_redemption(redemption):
	return {
		"id": redemption.id,
		"reference": redemption.reference,
		"channel": redemption.channel,
		"customerName": redemption.customer_name,
		"customerEmail": redemption.customer_email,
		"orderAmount": str(redemption.order_amount),
		"discountApplied": str(redemption.discount_applied),
		"finalAmount": str(redemption.final_amount),
		"merchant": redemption.merchant.slug if redemption.merchant else None,
		"createdAt": redemption.created_at.isoformat() if redemption.created_at else None,
	}


def _serialize_merchant(merchant):
	return {
		"id": merchant.id,
		"name": merchant.name,
		"slug": merchant.slug,
		"defaultChannel": merchant.default_channel,
		"supportsAllVouchers": merchant.supports_all_vouchers,
		"acceptedChannels": _normalize_channels(merchant.accepted_channels),
		"supportedCategories": _normalize_option_list(merchant.supported_categories),
		"supportedProviders": _normalize_option_list(merchant.supported_providers),
		"webhookUrl": merchant.webhook_url,
		"isActive": merchant.is_active,
		"metadata": merchant.metadata or {},
	}


def _serialize_provider_integration(integration):
	return {
		"id": integration.id,
		"providerSlug": integration.provider_slug,
		"displayName": integration.display_name,
		"mode": integration.mode,
		"endpoint": integration.endpoint,
		"authScheme": integration.auth_scheme,
		"authHeader": integration.auth_header,
		"timeoutSeconds": integration.timeout_seconds,
		"isActive": integration.is_active,
		"hasApiKey": bool(integration.api_key),
		"hasWebhookSecret": bool(integration.webhook_secret),
		"metadata": integration.metadata or {},
		"updatedAt": integration.updated_at.isoformat() if integration.updated_at else None,
	}


def _extract_bearer_token(request):
	authorization = str(request.headers.get("Authorization", "")).strip()
	if authorization.lower().startswith("bearer "):
		return authorization.split(" ", 1)[1].strip()
	return ""


def _merchant_from_request(request):
	merchant_key = str(request.headers.get("X-Merchant-Key", "")).strip() or _extract_bearer_token(request)
	if not merchant_key:
		return None
	return MerchantPartner.objects.filter(api_key=merchant_key, is_active=True).first()


def _merchant_accepts_voucher(merchant, voucher, channel=""):
	if not merchant or not merchant.is_active:
		return False
	merchant_channels = _normalize_channels(merchant.accepted_channels)
	if merchant_channels and channel and channel not in merchant_channels:
		return False
	if merchant.supports_all_vouchers:
		return True
	merchant_categories = set(_normalize_option_list(merchant.supported_categories))
	merchant_providers = set(_normalize_option_list(merchant.supported_providers))
	voucher_categories = set(_normalize_option_list(voucher.supported_categories))
	voucher_providers = set(_normalize_option_list(voucher.supported_providers))
	category_ok = not merchant_categories or not voucher_categories or bool(merchant_categories & voucher_categories)
	provider_ok = not merchant_providers or not voucher_providers or bool(merchant_providers & voucher_providers)
	return category_ok and provider_ok


def _redeem_locked_voucher(voucher, order_amount, reference="", customer_name="", customer_email="", channel="", metadata=None, merchant=None):
	metadata = metadata if isinstance(metadata, dict) else {}
	discount_applied = voucher.compute_discount(order_amount)
	final_amount = max(Decimal("0.00"), order_amount - discount_applied)
	redemption = VoucherRedemption.objects.create(
		merchant=merchant,
		voucher=voucher,
		reference=reference,
		customer_name=customer_name,
		customer_email=customer_email,
		channel=channel,
		order_amount=order_amount,
		discount_applied=discount_applied,
		final_amount=final_amount,
		metadata=metadata,
	)
	update_fields = ["usage_count", "updated_at"]
	voucher.usage_count += 1
	if voucher.voucher_kind == Voucher.VoucherKind.STORED_VALUE:
		current_balance = Decimal(str(voucher.remaining_balance or 0))
		voucher.remaining_balance = max(Decimal("0.00"), current_balance - discount_applied).quantize(Decimal("0.01"))
		update_fields.insert(0, "remaining_balance")
	voucher.save(update_fields=update_fields)
	return redemption


def _provider_status_to_purchase_status(status):
	status = str(status or "").strip().lower()
	if status in {"fulfilled", "success", "completed", "paid"}:
		return VoucherPurchase.Status.FULFILLED
	if status in {"failed", "error", "rejected", "declined"}:
		return VoucherPurchase.Status.FAILED
	return VoucherPurchase.Status.PENDING


def _voucher_product_error(voucher, product, total_amount, channel=""):
	base_error = _voucher_error(voucher, order_amount=total_amount, channel=channel)
	if base_error:
		return base_error
	if voucher.voucher_kind != Voucher.VoucherKind.STORED_VALUE:
		return "Only stored-value vouchers can buy catalog products."
	if not product or not product.is_active:
		return "Selected product is unavailable."
	if not voucher.supports_product(product):
		return "Voucher does not support this product category or provider."
	if Decimal(str(voucher.remaining_balance or 0)) < Decimal(str(total_amount or 0)):
		return "Voucher balance is too low for this purchase."
	return None


def voucher_zone(request):
	vouchers = Voucher.objects.all()[:150]
	redemptions = VoucherRedemption.objects.select_related("voucher")[:150]
	products = VoucherCatalogItem.objects.filter(is_active=True)[:150]
	purchases = VoucherPurchase.objects.select_related("voucher", "product")[:150]
	return render(
		request,
		"core/voucher-zone/index.html",
		{"vouchers": vouchers, "redemptions": redemptions, "products": products, "purchases": purchases},
	)


def _voucher_reporting_payload(days=30):
	now = timezone.now()
	try:
		days = max(1, int(days or 30))
	except (TypeError, ValueError):
		days = 30
	since = now - timedelta(days=days)
	voucher_counts = Voucher.objects.aggregate(
		total=Count("id"),
		active=Count("id", filter=Q(is_active=True)),
		stored_value=Count("id", filter=Q(voucher_kind=Voucher.VoucherKind.STORED_VALUE)),
	)
	purchase_counts = VoucherPurchase.objects.aggregate(
		total=Count("id"),
		fulfilled=Count("id", filter=Q(status=VoucherPurchase.Status.FULFILLED)),
		failed=Count("id", filter=Q(status=VoucherPurchase.Status.FAILED)),
		amount=Sum("total_amount"),
	)
	redemption_totals = VoucherRedemption.objects.aggregate(total=Sum("discount_applied"))
	balance_totals = Voucher.objects.filter(voucher_kind=Voucher.VoucherKind.STORED_VALUE).aggregate(
		remaining=Sum("remaining_balance")
	)
	provider_rows = list(
		VoucherPurchase.objects.values("product__provider")
		.annotate(count=Count("id"), amount=Sum("total_amount"))
		.order_by("-count", "product__provider")[:12]
	)
	trend_rows = list(
		VoucherPurchase.objects.filter(created_at__gte=since)
		.annotate(day=TruncDate("created_at"))
		.values("day")
		.annotate(count=Count("id"), amount=Sum("total_amount"))
		.order_by("day")
	)
	recent_failed = list(
		VoucherPurchase.objects.select_related("voucher", "product")
		.filter(status=VoucherPurchase.Status.FAILED)
		.order_by("-created_at")[:25]
	)
	return {
		"generatedAt": now.isoformat(),
		"rangeDays": days,
		"voucher": {
			"total": voucher_counts.get("total") or 0,
			"active": voucher_counts.get("active") or 0,
			"storedValue": voucher_counts.get("stored_value") or 0,
			"remainingBalance": str(balance_totals.get("remaining") or Decimal("0.00")),
		},
		"purchase": {
			"total": purchase_counts.get("total") or 0,
			"fulfilled": purchase_counts.get("fulfilled") or 0,
			"failed": purchase_counts.get("failed") or 0,
			"amount": str(purchase_counts.get("amount") or Decimal("0.00")),
		},
		"redemption": {
			"totalApplied": str(redemption_totals.get("total") or Decimal("0.00")),
		},
		"providers": [
			{
				"provider": row.get("product__provider") or "Unknown",
				"count": row.get("count") or 0,
				"amount": str(row.get("amount") or Decimal("0.00")),
			}
			for row in provider_rows
		],
		"trend": [
			{
				"day": str(row.get("day")),
				"count": row.get("count") or 0,
				"amount": str(row.get("amount") or Decimal("0.00")),
			}
			for row in trend_rows
		],
		"recentFailed": recent_failed,
	}


def voucher_reporting_dashboard(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])
	days = str(request.GET.get("days", "30")).strip()
	payload = _voucher_reporting_payload(days=days)
	return render(
		request,
		"core/voucher-zone/reporting.html",
		{
			"payload": payload,
			"recent_failed": payload["recentFailed"],
		},
	)


def voucher_reporting_data(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])
	days = str(request.GET.get("days", "30")).strip()
	payload = _voucher_reporting_payload(days=days)
	payload["recentFailed"] = [_serialize_purchase(item) for item in payload["recentFailed"]]
	return JsonResponse({"ok": True, "report": payload})


def voucher_list(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	queryset = Voucher.objects.all()
	status_filter = str(request.GET.get("status", "all")).strip().lower()
	channel = str(request.GET.get("channel", "")).strip().lower()
	order_amount = request.GET.get("orderAmount")
	code = str(request.GET.get("code", "")).strip().upper()
	voucher_kind = str(request.GET.get("voucherKind", "all")).strip().lower()
	available_only = str(request.GET.get("availableOnly", "")).strip().lower() in {"1", "true", "yes"}

	if code:
		queryset = queryset.filter(code=code)
	if voucher_kind in (Voucher.VoucherKind.DISCOUNT, Voucher.VoucherKind.STORED_VALUE):
		queryset = queryset.filter(voucher_kind=voucher_kind)
	if status_filter == "active":
		queryset = queryset.filter(is_active=True)
	elif status_filter == "inactive":
		queryset = queryset.filter(is_active=False)

	items = [
		_serialize_voucher(voucher, order_amount=order_amount, channel=channel)
		for voucher in queryset[:250]
	]
	if available_only:
		items = [
			item for item in items
			if item.get("isActive")
			and (item.get("usageCount") or 0) < (item.get("usageLimit") or 0)
			and Decimal(str(item.get("remainingBalance") or 0)) > 0
		]
	return JsonResponse({"ok": True, "count": len(items), "items": items})


@csrf_exempt
def voucher_generate(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])

	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)

	name = str(payload.get("name", "")).strip()
	if not name:
		return JsonResponse({"ok": False, "error": "Voucher name is required."}, status=400)
	voucher_kind = str(payload.get("voucherKind", Voucher.VoucherKind.DISCOUNT)).strip().lower()
	if voucher_kind not in (Voucher.VoucherKind.DISCOUNT, Voucher.VoucherKind.STORED_VALUE):
		return JsonResponse({"ok": False, "error": "Unsupported voucherKind."}, status=400)

	discount_type = str(payload.get("discountType", Voucher.DiscountType.FIXED)).strip().lower()
	if discount_type not in (Voucher.DiscountType.FIXED, Voucher.DiscountType.PERCENT):
		return JsonResponse({"ok": False, "error": "Unsupported discountType."}, status=400)

	discount_value = _parse_decimal(payload.get("discountValue"), default="0")
	initial_balance = _parse_decimal(payload.get("initialBalance"), default=str(discount_value or 0))
	if voucher_kind == Voucher.VoucherKind.DISCOUNT:
		if discount_value < 0:
			return JsonResponse({"ok": False, "error": "discountValue cannot be negative."}, status=400)
		if discount_type == Voucher.DiscountType.PERCENT and discount_value > 100:
			return JsonResponse({"ok": False, "error": "Percentage vouchers cannot exceed 100."}, status=400)
	else:
		if initial_balance <= 0:
			return JsonResponse({"ok": False, "error": "initialBalance must be greater than zero for stored-value vouchers."}, status=400)
		discount_type = Voucher.DiscountType.FIXED
		discount_value = Decimal("0.00")

	quantity = max(1, min(200, int(payload.get("quantity", 1) or 1)))
	usage_limit = max(1, int(payload.get("usageLimit", 1) or 1))
	min_order_amount = _parse_decimal(payload.get("minOrderAmount"), default="0")
	allowed_channels = _normalize_channels(payload.get("allowedChannels"))
	supported_categories = _normalize_option_list(payload.get("supportedCategories"))
	supported_providers = _normalize_option_list(payload.get("supportedProviders"))
	currency = str(payload.get("currency", "ZAR")).strip().upper() or "ZAR"
	prefix = str(payload.get("prefix", "")).strip().upper()
	code_charset = str(payload.get("codeCharset", "alnum")).strip().lower() or "alnum"
	code_length = int(payload.get("codeLength", payload.get("length", 10)) or 10)
	code_group_size = int(payload.get("codeGroupSize", 0) or 0)
	code_separator = str(payload.get("codeSeparator", "-")).strip() or "-"
	custom_code = str(payload.get("code", "")).strip().upper()
	is_global = bool(payload.get("isGlobal", True))
	notes = str(payload.get("notes", "")).strip()
	metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
	active_from = payload.get("activeFrom")
	expires_at = payload.get("expiresAt")

	try:
		active_from_dt = timezone.datetime.fromisoformat(str(active_from).replace("Z", "+00:00")) if active_from else None
		expires_at_dt = timezone.datetime.fromisoformat(str(expires_at).replace("Z", "+00:00")) if expires_at else None
	except ValueError:
		return JsonResponse({"ok": False, "error": "activeFrom or expiresAt is not a valid ISO datetime."}, status=400)

	if expires_at_dt and active_from_dt and expires_at_dt <= active_from_dt:
		return JsonResponse({"ok": False, "error": "expiresAt must be after activeFrom."}, status=400)
	if custom_code and quantity > 1:
		return JsonResponse({"ok": False, "error": "Custom code can only be used when quantity is 1."}, status=400)

	created_vouchers = []
	with transaction.atomic():
		for index in range(quantity):
			code = custom_code if index == 0 and custom_code else _generate_voucher_code(
				prefix=prefix,
				length=code_length,
				charset=code_charset,
				group_size=code_group_size,
				separator=code_separator,
			)
			if Voucher.objects.filter(code=code).exists():
				return JsonResponse({"ok": False, "error": f"Voucher code {code} already exists."}, status=400)
			voucher = Voucher.objects.create(
				name=name,
				code=code,
				voucher_kind=voucher_kind,
				discount_type=discount_type,
				discount_value=discount_value,
				initial_balance=initial_balance if voucher_kind == Voucher.VoucherKind.STORED_VALUE else Decimal("0.00"),
				remaining_balance=initial_balance if voucher_kind == Voucher.VoucherKind.STORED_VALUE else Decimal("0.00"),
				currency=currency,
				is_global=is_global,
				allowed_channels=allowed_channels,
				supported_categories=supported_categories,
				supported_providers=supported_providers,
				min_order_amount=min_order_amount,
				usage_limit=usage_limit,
				active_from=active_from_dt,
				expires_at=expires_at_dt,
				notes=notes,
				metadata={
					**metadata,
					"codeCharset": code_charset,
					"codeLength": code_length,
					"codeGroupSize": code_group_size,
					"codeSeparator": code_separator,
				},
			)
			created_vouchers.append(_serialize_voucher(voucher))

	return JsonResponse(
		{
			"ok": True,
			"count": len(created_vouchers),
			"items": created_vouchers,
			"isFreeGeneration": True,
			"generationFee": "0.00",
		},
		status=201,
	)


@csrf_exempt
def voucher_validate(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])

	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)

	code = str(payload.get("code", "")).strip().upper()
	channel = str(payload.get("channel", "")).strip().lower()
	order_amount = payload.get("orderAmount")
	if not code:
		return JsonResponse({"ok": False, "error": "Voucher code is required."}, status=400)

	voucher = Voucher.objects.filter(code=code).first()
	if not voucher:
		return JsonResponse({"ok": False, "error": "Voucher was not found."}, status=404)

	error = _voucher_error(voucher, order_amount=order_amount, channel=channel)
	if error:
		return JsonResponse({"ok": False, "error": error, "voucher": _serialize_voucher(voucher, order_amount=order_amount, channel=channel)}, status=400)

	return JsonResponse({"ok": True, "voucher": _serialize_voucher(voucher, order_amount=order_amount, channel=channel)})


def voucher_products(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	queryset = VoucherCatalogItem.objects.filter(is_active=True)
	category = str(request.GET.get("category", "")).strip().lower()
	provider = str(request.GET.get("provider", "")).strip().lower()
	query = str(request.GET.get("query", "")).strip()
	if category:
		queryset = queryset.filter(category=category)
	if provider:
		queryset = queryset.filter(provider__iexact=provider)
	if query:
		queryset = queryset.filter(name__icontains=query)
	items = [_serialize_catalog_item(item) for item in queryset[:250]]
	return JsonResponse({"ok": True, "count": len(items), "items": items})


@csrf_exempt
def voucher_redeem(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])

	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)

	code = str(payload.get("code", "")).strip().upper()
	if not code:
		return JsonResponse({"ok": False, "error": "Voucher code is required."}, status=400)

	order_amount = _parse_decimal(payload.get("orderAmount"), default="0")
	channel = str(payload.get("channel", "")).strip().lower()
	reference = str(payload.get("reference", "")).strip()
	customer_name = str(payload.get("customerName", "")).strip()
	customer_email = str(payload.get("customerEmail", "")).strip()
	metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}

	with transaction.atomic():
		voucher = Voucher.objects.select_for_update().filter(code=code).first()
		if not voucher:
			return JsonResponse({"ok": False, "error": "Voucher was not found."}, status=404)

		error = _voucher_error(voucher, order_amount=order_amount, channel=channel)
		if error:
			return JsonResponse({"ok": False, "error": error, "voucher": _serialize_voucher(voucher, order_amount=order_amount, channel=channel)}, status=400)

		redemption = _redeem_locked_voucher(
			voucher=voucher,
			order_amount=order_amount,
			reference=reference,
			customer_name=customer_name,
			customer_email=customer_email,
			channel=channel,
			metadata=metadata,
		)

	return JsonResponse(
		{
			"ok": True,
			"voucher": _serialize_voucher(voucher, order_amount=order_amount, channel=channel),
			"redemption": _serialize_redemption(redemption),
		}
	)


@csrf_exempt
def voucher_merchant_profile(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])
	merchant = _merchant_from_request(request)
	if not merchant:
		return JsonResponse({"ok": False, "error": "Merchant API key is required."}, status=401)
	return JsonResponse({"ok": True, "merchant": _serialize_merchant(merchant)})


@csrf_exempt
def voucher_merchant_quote(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])
	merchant = _merchant_from_request(request)
	if not merchant:
		return JsonResponse({"ok": False, "error": "Merchant API key is required."}, status=401)
	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)
	code = str(payload.get("code", "")).strip().upper()
	order_amount = _parse_decimal(payload.get("orderAmount"), default="0")
	channel = str(payload.get("channel", "")).strip().lower() or str(merchant.default_channel or merchant.slug).strip().lower()
	if not code:
		return JsonResponse({"ok": False, "error": "Voucher code is required."}, status=400)
	voucher = Voucher.objects.filter(code=code).first()
	if not voucher:
		return JsonResponse({"ok": False, "error": "Voucher was not found."}, status=404)
	if not _merchant_accepts_voucher(merchant, voucher, channel=channel):
		return JsonResponse({"ok": False, "error": "Merchant is not allowed to accept this voucher."}, status=403)
	error = _voucher_error(voucher, order_amount=order_amount, channel=channel)
	if error:
		return JsonResponse({"ok": False, "error": error, "voucher": _serialize_voucher(voucher, order_amount=order_amount, channel=channel)}, status=400)
	return JsonResponse({
		"ok": True,
		"merchant": _serialize_merchant(merchant),
		"voucher": _serialize_voucher(voucher, order_amount=order_amount, channel=channel),
		"quote": {
			"reference": str(payload.get("reference", "")).strip(),
			"orderAmount": str(order_amount),
			"discountAmount": str(voucher.compute_discount(order_amount)),
			"finalAmount": str(max(Decimal("0.00"), order_amount - voucher.compute_discount(order_amount))),
			"channel": channel,
		},
	})


@csrf_exempt
def voucher_merchant_redeem(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])
	merchant = _merchant_from_request(request)
	if not merchant:
		return JsonResponse({"ok": False, "error": "Merchant API key is required."}, status=401)
	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)
	code = str(payload.get("code", "")).strip().upper()
	if not code:
		return JsonResponse({"ok": False, "error": "Voucher code is required."}, status=400)
	order_amount = _parse_decimal(payload.get("orderAmount"), default="0")
	channel = str(payload.get("channel", "")).strip().lower() or str(merchant.default_channel or merchant.slug).strip().lower()
	reference = str(payload.get("reference", "")).strip()
	customer_name = str(payload.get("customerName", "")).strip()
	customer_email = str(payload.get("customerEmail", "")).strip()
	metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
	with transaction.atomic():
		voucher = Voucher.objects.select_for_update().filter(code=code).first()
		if not voucher:
			return JsonResponse({"ok": False, "error": "Voucher was not found."}, status=404)
		if not _merchant_accepts_voucher(merchant, voucher, channel=channel):
			return JsonResponse({"ok": False, "error": "Merchant is not allowed to accept this voucher."}, status=403)
		if reference:
			existing = VoucherRedemption.objects.select_related("merchant", "voucher").filter(merchant=merchant, reference=reference, voucher=voucher).first()
			if existing:
				return JsonResponse({
					"ok": True,
					"idempotent": True,
					"merchant": _serialize_merchant(merchant),
					"voucher": _serialize_voucher(voucher, order_amount=existing.order_amount, channel=existing.channel),
					"redemption": _serialize_redemption(existing),
				})
			error = _voucher_error(voucher, order_amount=order_amount, channel=channel)
			if error:
				return JsonResponse({"ok": False, "error": error, "voucher": _serialize_voucher(voucher, order_amount=order_amount, channel=channel)}, status=400)
			redemption = _redeem_locked_voucher(
				voucher=voucher,
				order_amount=order_amount,
				reference=reference,
				customer_name=customer_name,
				customer_email=customer_email,
				channel=channel,
				metadata={"type": "merchant_redemption", "merchantSlug": merchant.slug, **metadata},
				merchant=merchant,
			)
	return JsonResponse({
		"ok": True,
		"merchant": _serialize_merchant(merchant),
		"voucher": _serialize_voucher(voucher, order_amount=order_amount, channel=channel),
		"redemption": _serialize_redemption(redemption),
	})


def voucher_provider_integrations(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])
	items = [_serialize_provider_integration(item) for item in ProviderIntegration.objects.filter(is_active=True)[:100]]
	return JsonResponse({"ok": True, "count": len(items), "items": items})


@csrf_exempt
def voucher_provider_webhook(request, provider_slug):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])
	integration = ProviderIntegration.objects.filter(provider_slug=provider_slug, is_active=True).first()
	if not integration:
		return JsonResponse({"ok": False, "error": "Provider integration was not found."}, status=404)
	secret = str(integration.webhook_secret or "").strip()
	provided_secret = str(request.headers.get("X-Provider-Secret", "")).strip() or _extract_bearer_token(request)
	if secret and provided_secret != secret:
		return JsonResponse({"ok": False, "error": "Webhook secret is invalid."}, status=401)
	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)
	reference = str(payload.get("reference") or payload.get("orderReference") or payload.get("externalReference") or "").strip()
	event = ProviderWebhookEvent.objects.create(
		integration=integration,
		provider_slug=provider_slug,
		event_type=str(payload.get("eventType") or payload.get("status") or "notification").strip(),
		reference=reference,
		headers={key: value for key, value in request.headers.items()},
		payload=payload if isinstance(payload, dict) else {},
	)
	purchase = VoucherPurchase.objects.filter(reference=reference).order_by("-created_at").first() if reference else None
	message = "Webhook recorded."
	if purchase:
		purchase.status = _provider_status_to_purchase_status(payload.get("status"))
		fulfillment_code = str(payload.get("fulfillmentCode") or payload.get("voucherCode") or purchase.fulfillment_code or "").strip()
		purchase.fulfillment_code = fulfillment_code
		purchase.fulfillment_details = {
			**(purchase.fulfillment_details or {}),
			"webhook": payload,
		}
		purchase.save(update_fields=["status", "fulfillment_code", "fulfillment_details", "updated_at"])
		event.purchase = purchase
		event.processed = True
		event.status = "processed"
		message = f"Webhook applied to purchase {purchase.id}."
	else:
		event.status = "recorded"
	event.message = message
	event.save(update_fields=["purchase", "processed", "status", "message", "updated_at"])
	return JsonResponse({"ok": True, "eventId": event.id, "purchaseId": purchase.id if purchase else None, "message": message})


@csrf_exempt
def voucher_purchase(request):
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])

	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)

	code = str(payload.get("code", "")).strip().upper()
	product_id = payload.get("productId")
	if not code or not product_id:
		return JsonResponse({"ok": False, "error": "Voucher code and productId are required."}, status=400)

	channel = str(payload.get("channel", "")).strip().lower()
	reference = str(payload.get("reference", "")).strip()
	recipient_reference = str(payload.get("recipientReference", "")).strip()
	customer_name = str(payload.get("customerName", "")).strip()
	customer_email = str(payload.get("customerEmail", "")).strip()
	quantity = max(1, min(25, int(payload.get("quantity", 1) or 1)))
	metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}

	with transaction.atomic():
		voucher = Voucher.objects.select_for_update().filter(code=code).first()
		product = VoucherCatalogItem.objects.filter(id=product_id).first()
		if not voucher:
			return JsonResponse({"ok": False, "error": "Voucher was not found."}, status=404)
		if not product:
			return JsonResponse({"ok": False, "error": "Product was not found."}, status=404)
		if product.requires_recipient and not recipient_reference:
			return JsonResponse({"ok": False, "error": f"{product.recipient_label or 'Recipient'} is required."}, status=400)

		total_amount = (Decimal(str(product.sale_price or 0)) * Decimal(str(quantity))).quantize(Decimal("0.01"))
		error = _voucher_product_error(voucher, product, total_amount=total_amount, channel=channel)
		if error:
			return JsonResponse(
				{"ok": False, "error": error, "voucher": _serialize_voucher(voucher, order_amount=total_amount, channel=channel), "product": _serialize_catalog_item(product)},
				status=400,
			)

		purchase_status = VoucherPurchase.Status.FULFILLED
		try:
			fulfillment_result = fulfill_catalog_item(
				product=product,
				voucher_code=voucher.code,
				recipient_reference=recipient_reference,
				quantity=quantity,
				reference=reference,
				customer_name=customer_name,
				customer_email=customer_email,
			)
			fulfillment_code = str(fulfillment_result.get("fulfillmentCode") or "").strip()
			fulfillment_details = fulfillment_result.get("details") if isinstance(fulfillment_result.get("details"), dict) else {}
		except ProviderFulfillmentError as exc:
			purchase_status = VoucherPurchase.Status.FAILED
			fulfillment_code = ""
			fulfillment_details = {
				"error": str(exc),
				"providerError": exc.details or {},
			}

		purchase = VoucherPurchase.objects.create(
			voucher=voucher,
			product=product,
			reference=reference,
			recipient_reference=recipient_reference,
			customer_name=customer_name,
			customer_email=customer_email,
			channel=channel,
			quantity=quantity,
			total_amount=total_amount,
			status=purchase_status,
			fulfillment_code=fulfillment_code,
			fulfillment_details=fulfillment_details,
		)
		if purchase_status == VoucherPurchase.Status.FAILED:
			return JsonResponse(
				{
					"ok": False,
					"error": "Provider fulfillment failed.",
					"voucher": _serialize_voucher(voucher, order_amount=total_amount, channel=channel),
					"product": _serialize_catalog_item(product),
					"purchase": _serialize_purchase(purchase),
				},
				status=502,
			)
		VoucherRedemption.objects.create(
			voucher=voucher,
			reference=reference or f"PURCHASE-{purchase.id}",
			customer_name=customer_name,
			customer_email=customer_email,
			channel=channel,
			order_amount=total_amount,
			discount_applied=total_amount,
			final_amount=Decimal("0.00"),
			metadata={
				"type": "catalog_purchase",
				"productId": product.id,
				"product": product.name,
				"provider": product.provider,
				"purchaseId": purchase.id,
				**metadata,
			},
		)
		voucher.remaining_balance = (Decimal(str(voucher.remaining_balance or 0)) - total_amount).quantize(Decimal("0.01"))
		voucher.usage_count += 1
		voucher.save(update_fields=["remaining_balance", "usage_count", "updated_at"])

	return JsonResponse(
		{
			"ok": True,
			"voucher": _serialize_voucher(voucher, order_amount=total_amount, channel=channel),
			"product": _serialize_catalog_item(product),
			"purchase": _serialize_purchase(purchase),
		}
	)


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


def market_analyzer_dashboard(request):
	return render(
		request,
		"core/market_analyzer_dashboard.html",
		{"market_universe": MARKET_UNIVERSE, "market_universe_json": json.dumps(MARKET_UNIVERSE)},
	)


def _to_float(value):
	try:
		if value in (None, ""):
			return None
		return float(value)
	except (TypeError, ValueError):
		return None


def _safe_ratio(a, b):
	if a in (None, 0) or b in (None, 0):
		return 0
	try:
		return float(a) / float(b)
	except (TypeError, ValueError, ZeroDivisionError):
		return 0


def _market_session(now=None):
	now = now or timezone.now()
	hour = now.hour
	if 0 <= hour < 7:
		return "asia"
	if 7 <= hour < 13:
		return "london"
	if 13 <= hour < 21:
		return "new_york"
	return "after_hours"


def _feature_conditions(analysis):
	indicators = analysis.get("indicators") or {}
	entry_quality = analysis.get("entry_quality") or {}
	multi_tf = analysis.get("multi_timeframe") or {}
	trend = str(analysis.get("trend") or "").lower()
	slope = _to_float(indicators.get("close_slope_30")) or 0
	atr14 = _to_float(indicators.get("atr14")) or 0
	entry = _to_float(analysis.get("entry")) or _to_float(analysis.get("price")) or 0
	stop_loss = _to_float(analysis.get("stop_loss")) or 0
	t1 = _to_float((analysis.get("targets") or {}).get("T1")) or 0
	stop_distance = abs(entry - stop_loss) if entry and stop_loss else 0
	risk_reward = abs(t1 - entry) / stop_distance if stop_distance and t1 else 0
	volatility_pct = _safe_ratio(atr14, entry) * 100 if entry else 0
	conditions = []
	if trend in ("bullish", "bearish"):
		conditions.append(f"trend:{trend}")
	conditions.append(f"session:{_market_session()}")
	conditions.append("momentum:strong" if abs(slope) >= entry * 0.0004 else "momentum:weak")
	conditions.append("volatility:high" if volatility_pct >= 0.45 else "volatility:low")
	conditions.append("rr:healthy" if risk_reward >= 1.25 else "rr:thin")
	conditions.append("stop:wide" if stop_distance >= atr14 * 0.9 else "stop:tight")
	conditions.append(f"entry_quality:{entry_quality.get('label', 'unknown')}")
	conditions.append("mtf:aligned" if multi_tf.get("aligned") else "mtf:misaligned")
	return {
		"trend": trend,
		"session": _market_session(),
		"close_slope_30": slope,
		"atr14": atr14,
		"entry": entry,
		"stop_loss": stop_loss,
		"t1": t1,
		"stop_distance": stop_distance,
		"risk_reward_ratio": risk_reward,
		"volatility_pct": volatility_pct,
		"entry_quality": entry_quality,
		"multi_timeframe": multi_tf,
		"conditions": conditions,
	}


def _classify_root_causes(prediction):
	meta = prediction.metadata or {}
	indicators = meta.get("indicators") or {}
	causes = []
	trend = str(prediction.trend or "").lower()
	slope = _to_float(indicators.get("close_slope_30")) or 0
	atr14 = _to_float(indicators.get("atr14")) or 0
	entry = _to_float(prediction.entry) or _to_float(prediction.price_at_call) or 0
	stop = _to_float(prediction.stop_loss) or 0
	stop_distance = abs(entry - stop) if entry and stop else 0
	if trend == "bullish" and slope <= 0:
		causes.append("counter_trend_entry")
	if trend == "bearish" and slope >= 0:
		causes.append("counter_trend_entry")
	if atr14 and stop_distance and stop_distance < atr14 * 0.75:
		causes.append("stop_too_tight")
	if atr14 and entry and (atr14 / entry) < 0.0025:
		causes.append("low_volatility_fakeout")
	if meta.get("freshness_seconds") is not None and int(meta.get("freshness_seconds") or 0) > 180:
		causes.append("late_entry")
	if prediction.provider and prediction.provider != "auto" and meta.get("cache_hit"):
		causes.append("stale_context")
	if not causes:
		causes.append("regime_shift")
	return causes


def _classify_tp_drivers(prediction):
	meta = prediction.metadata or {}
	indicators = meta.get("indicators") or {}
	drivers = []
	trend = str(prediction.trend or "").lower()
	slope = _to_float(indicators.get("close_slope_30")) or 0
	atr14 = _to_float(indicators.get("atr14")) or 0
	entry = _to_float(prediction.entry) or _to_float(prediction.price_at_call) or 0
	stop = _to_float(prediction.stop_loss) or 0
	t1 = _to_float(prediction.t1) or 0
	stop_distance = abs(entry - stop) if entry and stop else 0
	risk_reward = abs(t1 - entry) / stop_distance if stop_distance and t1 else 0
	if trend in ("bullish", "bearish") and abs(slope) > 0:
		drivers.append(f"trend_alignment:{trend}")
	if risk_reward >= 1.25:
		drivers.append("healthy_rr")
	if atr14 and stop_distance >= atr14 * 0.9:
		drivers.append("volatility_aligned_stop")
	if meta.get("confidence_score", 0) >= 60:
		drivers.append("high_confidence_filter")
	if not drivers:
		drivers.append("timing_edge")
	return drivers


def _estimate_trade_excursions(prediction):
	entry = _to_float(prediction.entry) or _to_float(prediction.price_at_call) or 0
	resolved = _to_float(prediction.resolved_price) or _to_float(prediction.latest_price) or entry
	stop = _to_float(prediction.stop_loss) or entry
	if not entry:
		return 0, 0, 0
	is_bull = str(prediction.trend or "").lower() == "bullish"
	if is_bull:
		mfe = max(0, resolved - entry)
		mae = max(0, entry - min(resolved, stop))
	else:
		mfe = max(0, entry - resolved)
		mae = max(0, max(resolved, stop) - entry)
	trailing_stop_improvement = max(0, mfe - mae * 0.35)
	return mfe, mae, trailing_stop_improvement


def _prediction_friction(prediction):
	meta = prediction.metadata or {}
	features = meta.get("learning_features") or {}
	volatility_pct = _to_float(features.get("volatility_pct")) or 0
	base_slippage = 0.0004 if prediction.market == "forex" else 0.0009 if prediction.market == "crypto" else 0.0006
	base_spread = 0.0003 if prediction.market == "forex" else 0.0008 if prediction.market == "crypto" else 0.0005
	multiplier = 1.45 if volatility_pct >= 0.6 else 1.0
	return {
		"slippage_pct": round(base_slippage * multiplier, 6),
		"spread_pct": round(base_spread * multiplier, 6),
	}


def _trailing_stop_price(prediction):
	meta = prediction.metadata or {}
	target_profile = meta.get("target_profile") or {}
	trail_candidate = _to_float(target_profile.get("trailing_stop_candidate"))
	entry = _to_float(prediction.entry) or _to_float(prediction.price_at_call) or 0
	stop = _to_float(prediction.stop_loss) or 0
	if trail_candidate is not None:
		return trail_candidate
	if not entry or not stop:
		return None
	risk = abs(entry - stop)
	if not risk:
		return None
	if str(prediction.trend or "").lower() == "bullish":
		return round(entry + (risk * 0.55), 6)
	return round(entry - (risk * 0.55), 6)


def _reset_paper_account_periods(account):
	now = timezone.now()
	last_reset = account.last_risk_reset_at or account.created_at or now
	should_reset_daily = last_reset.date() != now.date()
	should_reset_session = should_reset_daily or (now - last_reset) >= timedelta(hours=8)
	updated_fields = []
	if should_reset_daily:
		account.daily_start_equity = float(account.equity or account.balance or 10000)
		account.daily_drawdown_pct = 0
		updated_fields.extend(["daily_start_equity", "daily_drawdown_pct"])
	if should_reset_session:
		account.session_start_equity = float(account.equity or account.balance or 10000)
		account.session_drawdown_pct = 0
		updated_fields.extend(["session_start_equity", "session_drawdown_pct"])
	if should_reset_daily or should_reset_session:
		account.last_risk_reset_at = now
		updated_fields.append("last_risk_reset_at")
		account.save(update_fields=updated_fields + ["updated_at"])
	return account


def _backfill_trade_path_metrics(prediction):
	if not prediction or not prediction.created_at:
		return _estimate_trade_excursions(prediction)
	try:
		fetch_result = fetch_candles_from_provider(
			symbol=prediction.symbol,
			interval=prediction.interval,
			market_range=None,
			market=prediction.market or None,
			provider=prediction.provider or "auto",
		)
		candles = fetch_result.get("candles", [])
		entry = _to_float(prediction.entry) or _to_float(prediction.price_at_call) or 0
		if not candles or not entry:
			return _estimate_trade_excursions(prediction)
		created_ts = prediction.created_at.astimezone(timezone.utc)
		resolved_ts = (prediction.resolved_at or timezone.now()).astimezone(timezone.utc)
		window = []
		for candle in candles:
			try:
				ts = timezone.datetime.fromisoformat(str(candle.get("time")).replace("Z", "+00:00")).astimezone(timezone.utc)
			except Exception:
				continue
			if created_ts <= ts <= resolved_ts:
				window.append(candle)
		if not window:
			return _estimate_trade_excursions(prediction)
		is_bull = str(prediction.trend or "").lower() == "bullish"
		if is_bull:
			mfe = max(max((_to_float(c.get("high")) or entry) - entry for c in window), 0)
			mae = max(max(entry - (_to_float(c.get("low")) or entry) for c in window), 0)
		else:
			mfe = max(max(entry - (_to_float(c.get("low")) or entry) for c in window), 0)
			mae = max(max((_to_float(c.get("high")) or entry) - entry for c in window), 0)
		trailing_stop_improvement = max(0, mfe - mae * 0.35)
		return mfe, mae, trailing_stop_improvement
	except Exception:
		return _estimate_trade_excursions(prediction)


def _resolve_trailing_outcome(prediction):
	if not prediction or prediction.outcome != MarketPrediction.Outcome.PENDING:
		return None
	trailing_stop = _trailing_stop_price(prediction)
	if trailing_stop is None or not prediction.created_at:
		return None
	try:
		fetch_result = fetch_candles_from_provider(
			symbol=prediction.symbol,
			interval=prediction.interval,
			market_range=None,
			market=prediction.market or None,
			provider=prediction.provider or "auto",
		)
		candles = fetch_result.get("candles", [])
		created_ts = prediction.created_at.astimezone(timezone.utc)
		is_bull = str(prediction.trend or "").lower() == "bullish"
		for candle in candles:
			try:
				ts = timezone.datetime.fromisoformat(str(candle.get("time")).replace("Z", "+00:00")).astimezone(timezone.utc)
			except Exception:
				continue
			if ts < created_ts:
				continue
			high = _to_float(candle.get("high"))
			low = _to_float(candle.get("low"))
			if high is None or low is None:
				continue
			if is_bull and low <= trailing_stop:
				return {"outcome": MarketPrediction.Outcome.TP1, "resolved_price": trailing_stop, "resolution_note": "trailing_stop_lock"}
			if not is_bull and high >= trailing_stop:
				return {"outcome": MarketPrediction.Outcome.TP1, "resolved_price": trailing_stop, "resolution_note": "trailing_stop_lock"}
	except Exception:
		return None
	return None


def _apply_paper_trade_result(prediction):
	account, _ = PaperTradingAccount.objects.get_or_create(name="main")
	account = _reset_paper_account_periods(account)
	entry = _to_float(prediction.entry) or _to_float(prediction.price_at_call) or 0
	resolved = _to_float(prediction.resolved_price) or entry
	stop = _to_float(prediction.stop_loss) or entry
	if not entry or not stop:
		return None
	friction = _prediction_friction(prediction)
	risk_per_trade = max(abs(entry - stop), entry * 0.002)
	fees = entry * ((friction.get("slippage_pct") or 0) + (friction.get("spread_pct") or 0))
	is_bull = str(prediction.trend or "").lower() == "bullish"
	gross_move = (resolved - entry) if is_bull else (entry - resolved)
	net_move = gross_move - fees
	r_multiple = net_move / risk_per_trade if risk_per_trade else 0
	position_risk_cash = max(account.balance * (float(account.max_risk_per_trade_pct or 1.0) / 100.0), 25)
	pnl = round(position_risk_cash * r_multiple, 2)
	account.balance = round(account.balance + pnl, 2)
	account.equity = account.balance
	account.peak_equity = max(account.peak_equity, account.equity)
	daily_base = float(account.daily_start_equity or account.peak_equity or account.equity or 1)
	session_base = float(account.session_start_equity or account.peak_equity or account.equity or 1)
	if account.peak_equity:
		drawdown_pct = ((account.peak_equity - account.equity) / account.peak_equity) * 100
		account.max_drawdown_pct = max(account.max_drawdown_pct, round(drawdown_pct, 2))
	account.daily_drawdown_pct = round(max(0, ((daily_base - account.equity) / daily_base) * 100), 2) if daily_base else 0
	account.session_drawdown_pct = round(max(0, ((session_base - account.equity) / session_base) * 100), 2) if session_base else 0
	risk_alerts = []
	if account.daily_drawdown_pct >= float(account.max_daily_drawdown_pct or 4.0):
		risk_alerts.append("daily_drawdown_lock")
	if account.session_drawdown_pct >= float(account.max_session_drawdown_pct or 2.5):
		risk_alerts.append("session_drawdown_lock")
	account.risk_state = "restricted" if risk_alerts else "normal"
	account.trade_count += 1
	if pnl >= 0:
		account.win_count += 1
	else:
		account.loss_count += 1
	avg_expectancy = ((account.balance - 10000) / account.trade_count) if account.trade_count else 0
	account.stats = {
		"win_rate": round((account.win_count / account.trade_count) * 100, 2) if account.trade_count else None,
		"expectancy_per_trade": round(avg_expectancy, 2),
		"last_pnl": pnl,
		"last_r_multiple": round(r_multiple, 4),
		"equity_curve": [*((account.stats or {}).get("equity_curve", [])[-59:]), {
			"at": timezone.now().isoformat(),
			"equity": account.equity,
			"balance": account.balance,
			"pnl": pnl,
		}],
		"risk_alerts": risk_alerts,
	}
	account.save(update_fields=[
		"balance",
		"equity",
		"peak_equity",
		"max_drawdown_pct",
		"daily_drawdown_pct",
		"session_drawdown_pct",
		"risk_state",
		"win_count",
		"loss_count",
		"trade_count",
		"stats",
		"updated_at",
	])
	prediction.simulated_pnl = pnl
	prediction.simulated_r_multiple = round(r_multiple, 4)
	prediction.save(update_fields=["simulated_pnl", "simulated_r_multiple"])
	return account


def _policy_state_dict(policy):
	return {
		"confidence_threshold": policy.confidence_threshold,
		"min_risk_reward": policy.min_risk_reward,
		"preferred_sessions": list(policy.preferred_sessions or []),
		"blocked_conditions": list(policy.blocked_conditions or []),
		"preferred_conditions": list(policy.preferred_conditions or []),
		"stats": dict(policy.stats or {}),
	}


def _should_rollback_policy(previous_state, candidate_stats):
	if not previous_state:
		return False
	prev_win = _to_float((previous_state.get("stats") or {}).get("win_rate")) or 0
	new_win = _to_float((candidate_stats or {}).get("win_rate")) or 0
	prev_sl = _to_float((previous_state.get("stats") or {}).get("sl_hits")) or 0
	new_sl = _to_float((candidate_stats or {}).get("sl_hits")) or 0
	return new_win + 4 < prev_win or (new_sl > prev_sl and new_win < prev_win)


def _get_policy(scope="global"):
	policy, _ = AdaptiveTradingPolicy.objects.get_or_create(scope=scope)
	return policy


def _policy_scopes_for_analysis(analysis):
	symbol = str(analysis.get("symbol") or "").upper()
	interval = str(analysis.get("interval") or "").lower()
	scopes = ["global"]
	if symbol:
		scopes.append(f"symbol:{symbol}")
	if interval:
		scopes.append(f"interval:{interval}")
	if symbol and interval:
		scopes.append(f"symbol_interval:{symbol}:{interval}")
	return scopes


def _merge_policy_chain(scopes):
	merged = {
		"confidence_threshold": 58.0,
		"min_risk_reward": 1.25,
		"preferred_sessions": [],
		"blocked_conditions": [],
		"preferred_conditions": [],
		"stats": {},
		"scopes": [],
	}
	for scope in scopes:
		policy = _get_policy(scope)
		merged["confidence_threshold"] = max(merged["confidence_threshold"], float(policy.confidence_threshold or 0))
		merged["min_risk_reward"] = max(merged["min_risk_reward"], float(policy.min_risk_reward or 0))
		merged["preferred_sessions"] = list(dict.fromkeys(merged["preferred_sessions"] + list(policy.preferred_sessions or [])))
		merged["blocked_conditions"] = list(dict.fromkeys(merged["blocked_conditions"] + list(policy.blocked_conditions or [])))
		merged["preferred_conditions"] = list(dict.fromkeys(merged["preferred_conditions"] + list(policy.preferred_conditions or [])))
		merged["scopes"].append(_serialize_policy(policy))
	return merged


def _serialize_policy(policy):
	return {
		"scope": policy.scope,
		"confidence_threshold": policy.confidence_threshold,
		"min_risk_reward": policy.min_risk_reward,
		"preferred_sessions": policy.preferred_sessions,
		"blocked_conditions": policy.blocked_conditions,
		"preferred_conditions": policy.preferred_conditions,
		"stats": policy.stats,
		"updated_at": policy.updated_at.isoformat() if policy.updated_at else None,
	}


def _compute_confidence_score(analysis, policy=None):
	features = _feature_conditions(analysis)
	policy = policy or _merge_policy_chain(_policy_scopes_for_analysis(analysis))
	score = 50.0
	trend = features["trend"]
	if trend in ("bullish", "bearish"):
		score += 8
	if abs(features["close_slope_30"]) >= (features["entry"] * 0.0004 if features["entry"] else 0):
		score += 10
	if features["risk_reward_ratio"] >= policy["min_risk_reward"]:
		score += 12
	if features["session"] in (policy["preferred_sessions"] or []):
		score += 6
	if (features.get("entry_quality") or {}).get("score", 0) >= 75:
		score += 8
	if (features.get("multi_timeframe") or {}).get("aligned"):
		score += 10
	condition_set = set(features["conditions"])
	blocked = len([c for c in policy["blocked_conditions"] if c in condition_set])
	preferred = len([c for c in policy["preferred_conditions"] if c in condition_set])
	score += preferred * 4
	score -= blocked * 8
	return max(1.0, min(99.0, round(score, 2))), features


def _apply_learning_to_analysis(analysis):
	policy = _merge_policy_chain(_policy_scopes_for_analysis(analysis))
	confidence_score, features = _compute_confidence_score(analysis, policy=policy)
	analysis["confidence_score"] = confidence_score
	analysis["learning_features"] = features
	analysis["policy_state"] = policy
	risk_reward = features["risk_reward_ratio"]
	entry_quality_score = float((features.get("entry_quality") or {}).get("score") or 0)
	mtf_aligned = bool((features.get("multi_timeframe") or {}).get("aligned"))
	allowed = (
		confidence_score >= policy["confidence_threshold"] and
		risk_reward >= policy["min_risk_reward"] and
		entry_quality_score >= 55 and
		mtf_aligned
	)
	analysis["execution_gate"] = {
		"allowed": allowed,
		"reason": "approved" if allowed else "filtered_by_learning_policy",
		"confidence_threshold": policy["confidence_threshold"],
		"min_risk_reward": policy["min_risk_reward"],
		"entry_quality_floor": 55,
		"requires_multi_timeframe_alignment": True,
	}
	if not allowed:
		analysis["reasoning"] = list(analysis.get("reasoning") or []) + [
			f"Adaptive policy filtered this setup: confidence {confidence_score} vs threshold {policy['confidence_threshold']}, RR {round(risk_reward, 2)} vs minimum {policy['min_risk_reward']}, entry quality {entry_quality_score}, MTF aligned {mtf_aligned}."
		]
	return analysis


def _update_learning_state(prediction):
	if not prediction or prediction.outcome == MarketPrediction.Outcome.PENDING:
		return None
	meta = prediction.metadata or {}
	indicators = meta.get("indicators") or {}
	entry = _to_float(prediction.entry) or _to_float(prediction.price_at_call) or 0
	stop = _to_float(prediction.stop_loss) or 0
	t1 = _to_float(prediction.t1) or 0
	stop_distance = abs(entry - stop) if entry and stop else 0
	risk_reward = abs(t1 - entry) / stop_distance if stop_distance and t1 else 0
	stop_distance_pct = (_safe_ratio(stop_distance, entry) * 100) if entry else 0
	if prediction.outcome == MarketPrediction.Outcome.SL:
		root_causes = _classify_root_causes(prediction)
		tp_drivers = []
	else:
		root_causes = []
		tp_drivers = _classify_tp_drivers(prediction)
	mfe, mae, trailing_stop_improvement = _backfill_trade_path_metrics(prediction)
	TradeLearningSnapshot.objects.update_or_create(
		prediction=prediction,
		defaults={
			"market": prediction.market,
			"symbol": prediction.symbol,
			"interval": prediction.interval,
			"trend": prediction.trend,
			"outcome": prediction.outcome,
			"confidence_score": float(meta.get("confidence_score") or 0),
			"risk_reward_ratio": risk_reward,
			"stop_distance": stop_distance,
			"stop_distance_pct": stop_distance_pct,
			"mae": mae,
			"mfe": mfe,
			"trailing_stop_improvement": trailing_stop_improvement,
			"atr14": _to_float(indicators.get("atr14")),
			"close_slope_30": _to_float(indicators.get("close_slope_30")),
			"learning_features": meta.get("learning_features") or {},
			"root_causes": root_causes,
			"tp_drivers": tp_drivers,
			"policy_snapshot": meta.get("policy_state") or {},
		},
	)
	_apply_paper_trade_result(prediction)
	_refresh_adaptive_policy(scopes=["global", f"symbol:{prediction.symbol}", f"interval:{prediction.interval.lower()}", f"symbol_interval:{prediction.symbol}:{prediction.interval.lower()}"])
	return True


def _refresh_adaptive_policy(scopes=None):
	scopes = scopes or ["global"]
	policies = []
	for scope in scopes:
		policy = _get_policy(scope)
		previous_state = _policy_state_dict(policy)
		queryset = TradeLearningSnapshot.objects.exclude(outcome=MarketPrediction.Outcome.PENDING)
		if scope.startswith("symbol_interval:"):
			_, symbol, interval = scope.split(":", 2)
			queryset = queryset.filter(symbol=symbol, interval=interval)
		elif scope.startswith("symbol:"):
			queryset = queryset.filter(symbol=scope.split(":", 1)[1])
		elif scope.startswith("interval:"):
			queryset = queryset.filter(interval=scope.split(":", 1)[1])
		items = list(queryset.order_by("-created_at")[:250])
		if not items:
			policies.append(policy)
			continue
		tp_items = [item for item in items if str(item.outcome).startswith("tp")]
		sl_items = [item for item in items if item.outcome == MarketPrediction.Outcome.SL]
		confidence_values = [item.confidence_score for item in tp_items if item.confidence_score]
		rr_values = [item.risk_reward_ratio for item in tp_items if item.risk_reward_ratio]
		entry_quality_values = [float((item.learning_features or {}).get("entry_quality", {}).get("score") or 0) for item in tp_items]
		trailing_values = [float(item.trailing_stop_improvement or 0) for item in tp_items if item.trailing_stop_improvement]
		policy.confidence_threshold = round(max(50.0, min(88.0, (sum(confidence_values) / len(confidence_values)) - 4)), 2) if confidence_values else policy.confidence_threshold
		policy.min_risk_reward = round(max(1.0, min(3.2, (sum(rr_values) / len(rr_values)) * 0.92)), 2) if rr_values else policy.min_risk_reward
		tp_driver_counts = Counter(driver for item in tp_items for driver in (item.tp_drivers or []))
		sl_cause_counts = Counter(cause for item in sl_items for cause in (item.root_causes or []))
		preferred_sessions = Counter((item.learning_features or {}).get("session") for item in tp_items if (item.learning_features or {}).get("session"))
		policy.preferred_conditions = [name for name, _ in tp_driver_counts.most_common(6)]
		policy.blocked_conditions = [name for name, _ in sl_cause_counts.most_common(6)]
		policy.preferred_sessions = [name for name, _ in preferred_sessions.most_common(3)]
		policy.stats = {
			"resolved": len(items),
			"tp_hits": len(tp_items),
			"sl_hits": len(sl_items),
			"win_rate": round((len(tp_items) / len(items)) * 100, 2) if items else None,
			"top_tp_drivers": tp_driver_counts.most_common(5),
			"top_sl_causes": sl_cause_counts.most_common(5),
			"avg_entry_quality": round(sum(entry_quality_values) / len(entry_quality_values), 2) if entry_quality_values else None,
			"avg_trailing_stop_improvement": round(sum(trailing_values) / len(trailing_values), 4) if trailing_values else 0,
		}
		if _should_rollback_policy(previous_state, policy.stats):
			policy.confidence_threshold = previous_state.get("confidence_threshold", policy.confidence_threshold)
			policy.min_risk_reward = previous_state.get("min_risk_reward", policy.min_risk_reward)
			policy.preferred_sessions = previous_state.get("preferred_sessions", policy.preferred_sessions)
			policy.blocked_conditions = previous_state.get("blocked_conditions", policy.blocked_conditions)
			policy.preferred_conditions = previous_state.get("preferred_conditions", policy.preferred_conditions)
			policy.stats = previous_state.get("stats", policy.stats)
			policy.rollback_count = int(policy.rollback_count or 0) + 1
		else:
			policy.previous_state = previous_state
		policy.save(update_fields=[
			"confidence_threshold",
			"min_risk_reward",
			"rollback_count",
			"preferred_sessions",
			"blocked_conditions",
			"preferred_conditions",
			"previous_state",
			"stats",
			"updated_at",
		])
		policies.append(policy)
	return policies[0] if len(policies) == 1 else policies


def _build_learning_summary(queryset=None):
	queryset = queryset or TradeLearningSnapshot.objects.all()
	items = list(queryset.order_by("-created_at")[:400])
	tp_items = [item for item in items if str(item.outcome).startswith("tp")]
	sl_items = [item for item in items if item.outcome == MarketPrediction.Outcome.SL]
	root_cause_counts = Counter(cause for item in sl_items for cause in (item.root_causes or []))
	tp_driver_counts = Counter(driver for item in tp_items for driver in (item.tp_drivers or []))
	policy = _get_policy("global")
	account = PaperTradingAccount.objects.filter(name="main").first()
	risk_alerts = list(((account.stats or {}).get("risk_alerts") or [])) if account else []
	return {
		"total_learned": len(items),
		"tp_learnings": len(tp_items),
		"sl_learnings": len(sl_items),
		"top_sl_causes": [{"name": name, "count": count} for name, count in root_cause_counts.most_common(6)],
		"top_tp_drivers": [{"name": name, "count": count} for name, count in tp_driver_counts.most_common(6)],
		"policy": _serialize_policy(policy),
		"symbol_policies": [
			_serialize_policy(item) for item in AdaptiveTradingPolicy.objects.filter(scope__startswith="symbol:").order_by("scope")[:12]
		],
		"interval_policies": [
			_serialize_policy(item) for item in AdaptiveTradingPolicy.objects.filter(scope__startswith="interval:").order_by("scope")[:12]
		],
		"rollback_events": AdaptiveTradingPolicy.objects.filter(rollback_count__gt=0).count(),
		"paper_account": (lambda account: {
			"balance": account.balance,
			"equity": account.equity,
			"peak_equity": account.peak_equity,
			"max_drawdown_pct": account.max_drawdown_pct,
			"daily_drawdown_pct": account.daily_drawdown_pct,
			"session_drawdown_pct": account.session_drawdown_pct,
			"max_daily_drawdown_pct": account.max_daily_drawdown_pct,
			"max_session_drawdown_pct": account.max_session_drawdown_pct,
			"risk_state": account.risk_state,
			"trade_count": account.trade_count,
			"win_count": account.win_count,
			"loss_count": account.loss_count,
			"stats": account.stats,
		} if account else None)(account),
		"risk_alerts": risk_alerts,
	}


def _prediction_outcome_for_price(prediction, current_price):
	if current_price is None:
		return None

	sl = prediction.stop_loss
	t1, t2, t3, t4 = prediction.t1, prediction.t2, prediction.t3, prediction.t4
	is_bull = (prediction.trend or "").lower() == "bullish"

	if is_bull:
		if sl is not None and current_price <= sl:
			return MarketPrediction.Outcome.SL
		if t4 is not None and current_price >= t4:
			return MarketPrediction.Outcome.TP4
		if t3 is not None and current_price >= t3:
			return MarketPrediction.Outcome.TP3
		if t2 is not None and current_price >= t2:
			return MarketPrediction.Outcome.TP2
		if t1 is not None and current_price >= t1:
			return MarketPrediction.Outcome.TP1
	else:
		if sl is not None and current_price >= sl:
			return MarketPrediction.Outcome.SL
		if t4 is not None and current_price <= t4:
			return MarketPrediction.Outcome.TP4
		if t3 is not None and current_price <= t3:
			return MarketPrediction.Outcome.TP3
		if t2 is not None and current_price <= t2:
			return MarketPrediction.Outcome.TP2
		if t1 is not None and current_price <= t1:
			return MarketPrediction.Outcome.TP1

	return None


def _resolve_pending_predictions(symbol, current_price):
	if current_price is None:
		return 0

	pending = MarketPrediction.objects.filter(
		symbol=symbol,
		outcome=MarketPrediction.Outcome.PENDING,
	)
	resolved_count = 0
	for prediction in pending:
		outcome = _prediction_outcome_for_price(prediction, current_price)
		trailing_resolution = None
		if not outcome:
			trailing_resolution = _resolve_trailing_outcome(prediction)
			if trailing_resolution:
				outcome = trailing_resolution.get("outcome")
		changed_fields = []
		if outcome:
			prediction.outcome = outcome
			prediction.resolved_price = _to_float((trailing_resolution or {}).get("resolved_price")) or current_price
			prediction.resolved_at = timezone.now()
			prediction.latest_price = current_price
			if trailing_resolution:
				meta = dict(prediction.metadata or {})
				meta["resolution_note"] = trailing_resolution.get("resolution_note")
				prediction.metadata = meta
				changed_fields = ["outcome", "resolved_price", "resolved_at", "latest_price", "metadata"]
			else:
				changed_fields = ["outcome", "resolved_price", "resolved_at", "latest_price"]
			message = f"{prediction.symbol} {prediction.interval} {outcome.upper()} at {current_price}"
			_send_alert_channels(prediction, message)
			resolved_count += 1
		elif prediction.latest_price != current_price:
			prediction.latest_price = current_price
			changed_fields = ["latest_price"]
		if changed_fields:
			prediction.save(update_fields=changed_fields)
			if outcome:
				_update_learning_state(prediction)
	return resolved_count


def _record_market_prediction(analysis, market_name, dedupe_seconds=45):
	now = timezone.now()
	symbol = str(analysis.get("symbol", "")).strip().upper()
	interval = str(analysis.get("interval", "")).strip()
	provider = str(analysis.get("provider", "")).strip().lower()
	price_now = _to_float(analysis.get("price"))

	if not symbol or not interval:
		return None, False

	recent_cutoff = now - timedelta(seconds=dedupe_seconds)
	existing = MarketPrediction.objects.filter(
		symbol=symbol,
		interval=interval,
		provider=provider,
		outcome=MarketPrediction.Outcome.PENDING,
		created_at__gte=recent_cutoff,
	).order_by("-created_at").first()

	if existing:
		existing.latest_price = price_now
		existing.save(update_fields=["latest_price"])
		return existing, False

	targets = analysis.get("targets") or {}
	prediction = MarketPrediction.objects.create(
		market=(market_name or "unspecified").lower(),
		symbol=symbol,
		interval=interval,
		provider=provider,
		provider_label=str(analysis.get("provider_label", ""))[:80],
		symbol_resolved=str(analysis.get("symbol_resolved", symbol))[:32],
		trend=str(analysis.get("trend", ""))[:16],
		entry=_to_float(analysis.get("entry")),
		stop_loss=_to_float(analysis.get("stop_loss")),
		t1=_to_float(targets.get("T1")),
		t2=_to_float(targets.get("T2")),
		t3=_to_float(targets.get("T3")),
		t4=_to_float(targets.get("T4")),
		price_at_call=price_now,
		latest_price=price_now,
		metadata={
			"requested_provider": analysis.get("provider"),
			"freshness_seconds": analysis.get("freshness_seconds"),
			"cache_hit": analysis.get("cache_hit"),
			"confidence_score": analysis.get("confidence_score"),
			"learning_features": analysis.get("learning_features") or {},
			"policy_state": analysis.get("policy_state") or {},
			"indicators": analysis.get("indicators") or {},
		},
	)
	return prediction, True


def _log_provider_attempts(analysis, market_name):
	attempts = analysis.get("provider_attempts") or []
	if not isinstance(attempts, list):
		return 0

	created = 0
	for item in attempts:
		try:
			ProviderHealthEvent.objects.create(
				market=(market_name or "unspecified").lower(),
				symbol=str(analysis.get("symbol", "")).upper()[:32],
				interval=str(analysis.get("interval", ""))[:12],
				provider=str(item.get("provider", ""))[:40],
				ok=bool(item.get("ok")),
				latency_ms=int(item.get("latency_ms") or 0),
				error=str(item.get("error") or "")[:2000],
			)
			created += 1
		except Exception:
			continue
	# Prune table to keep the last 2000 rows — prevents unbounded growth
	try:
		max_rows = 2000
		count = ProviderHealthEvent.objects.count()
		if count > max_rows:
			cutoff_id = ProviderHealthEvent.objects.order_by("-id")[max_rows - 1].id
			ProviderHealthEvent.objects.filter(id__lt=cutoff_id).delete()
	except Exception:
		pass
	return created


def _send_alert_channels(prediction, message):
	if not prediction:
		return

	channels_sent = 0

	webhook_url = os.getenv("MARKET_ALERT_WEBHOOK_URL", "").strip()
	if webhook_url:
		payload = {
			"symbol": prediction.symbol,
			"interval": prediction.interval,
			"market": prediction.market,
			"provider": prediction.provider,
			"outcome": prediction.outcome,
			"resolved_price": prediction.resolved_price,
			"message": message,
			"created_at": prediction.created_at.isoformat() if prediction.created_at else None,
			"resolved_at": prediction.resolved_at.isoformat() if prediction.resolved_at else None,
		}
		try:
			request = Request(
				webhook_url,
				data=json.dumps(payload).encode("utf-8"),
				headers={"Content-Type": "application/json"},
				method="POST",
			)
			with urlopen(request, timeout=10):
				pass
			AlertDeliveryLog.objects.create(prediction=prediction, channel="webhook", status="sent", message=message)
			channels_sent += 1
		except Exception as exc:
			AlertDeliveryLog.objects.create(
				prediction=prediction,
				channel="webhook",
				status="failed",
				message=message,
				error=str(exc)[:2000],
			)

	telegram_token = os.getenv("MARKET_ALERT_TELEGRAM_BOT_TOKEN", "").strip()
	telegram_chat = os.getenv("MARKET_ALERT_TELEGRAM_CHAT_ID", "").strip()
	if telegram_token and telegram_chat:
		text = (
			f"{prediction.symbol} {prediction.interval} {prediction.outcome.upper()}\n"
			f"Price: {prediction.resolved_price}\n{message}"
		)
		telegram_url = f"https://api.telegram.org/bot{telegram_token}/sendMessage"
		try:
			request = Request(
				telegram_url,
				data=json.dumps({"chat_id": telegram_chat, "text": text}).encode("utf-8"),
				headers={"Content-Type": "application/json"},
				method="POST",
			)
			with urlopen(request, timeout=10):
				pass
			AlertDeliveryLog.objects.create(prediction=prediction, channel="telegram", status="sent", message=message)
			channels_sent += 1
		except Exception as exc:
			AlertDeliveryLog.objects.create(
				prediction=prediction,
				channel="telegram",
				status="failed",
				message=message,
				error=str(exc)[:2000],
			)

	email_to = os.getenv("MARKET_ALERT_EMAIL_TO", "").strip()
	if email_to:
		subject = f"Market Alert {prediction.symbol} {prediction.interval} {prediction.outcome.upper()}"
		body = (
			f"{message}\n\n"
			f"Symbol: {prediction.symbol}\n"
			f"Interval: {prediction.interval}\n"
			f"Outcome: {prediction.outcome}\n"
			f"Resolved price: {prediction.resolved_price}\n"
		)
		try:
			send_mail(
				subject,
				body,
				getattr(settings, "DEFAULT_FROM_EMAIL", "alerts@localhost"),
				[email_to],
				fail_silently=False,
			)
			AlertDeliveryLog.objects.create(prediction=prediction, channel="email", status="sent", message=message)
			channels_sent += 1
		except Exception as exc:
			AlertDeliveryLog.objects.create(
				prediction=prediction,
				channel="email",
				status="failed",
				message=message,
				error=str(exc)[:2000],
			)

	return channels_sent


def _simulate_outcome(trend, stop_loss, targets, future_candles):
	if trend not in ("bullish", "bearish"):
		return "pending"

	t1 = _to_float(targets.get("T1"))
	t2 = _to_float(targets.get("T2"))
	t3 = _to_float(targets.get("T3"))
	t4 = _to_float(targets.get("T4"))
	sl = _to_float(stop_loss)

	for candle in future_candles:
		high = _to_float(candle.get("high"))
		low = _to_float(candle.get("low"))
		if high is None or low is None:
			continue

		if trend == "bullish":
			if sl is not None and low <= sl:
				return "sl"
			if t4 is not None and high >= t4:
				return "tp4"
			if t3 is not None and high >= t3:
				return "tp3"
			if t2 is not None and high >= t2:
				return "tp2"
			if t1 is not None and high >= t1:
				return "tp1"
		else:
			if sl is not None and high >= sl:
				return "sl"
			if t4 is not None and low <= t4:
				return "tp4"
			if t3 is not None and low <= t3:
				return "tp3"
			if t2 is not None and low <= t2:
				return "tp2"
			if t1 is not None and low <= t1:
				return "tp1"

	return "pending"


def market_symbols(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	market = request.GET.get("market", "").strip().lower()
	if market:
		symbols = MARKET_UNIVERSE.get(market)
		if symbols is None:
			return JsonResponse({"ok": False, "error": "Unsupported market type."}, status=400)
		return JsonResponse({"ok": True, "market": market, "symbols": symbols})

	return JsonResponse({"ok": True, "markets": MARKET_UNIVERSE})


def market_providers(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	market = request.GET.get("market", "").strip().lower()
	providers = get_supported_providers(market=market or None)
	return JsonResponse({"ok": True, "market": market or None, "providers": providers})


def market_analyze(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	symbol = request.GET.get("symbol", "").strip().upper()
	market = request.GET.get("market", "").strip().lower()
	interval = request.GET.get("interval", "15m").strip()
	market_range = request.GET.get("range", "").strip()
	provider = request.GET.get("provider", "auto").strip().lower()
	live_mode = request.GET.get("live", "0").strip().lower() in ("1", "true", "yes", "on")
	record_prediction = request.GET.get("record", "1").strip().lower() not in ("0", "false", "no", "off")

	if not symbol:
		if market and market in MARKET_UNIVERSE and MARKET_UNIVERSE[market]:
			symbol = MARKET_UNIVERSE[market][0]
		else:
			return JsonResponse({"ok": False, "error": "Provide symbol or valid market."}, status=400)

	try:
		analysis = analyze_market_symbol(
			symbol=symbol,
			interval=interval,
			market_range=market_range or None,
			market=market or None,
			provider=provider,
			use_cache=not live_mode,
		)
	except MarketDataError as exc:
		return JsonResponse({"ok": False, "error": str(exc)}, status=502)

	analysis["market"] = market or "unspecified"
	analysis = _apply_learning_to_analysis(analysis)
	provider_health_events = _log_provider_attempts(analysis=analysis, market_name=analysis["market"])
	current_price = _to_float(analysis.get("price"))
	updated_outcomes = _resolve_pending_predictions(symbol=symbol, current_price=current_price)
	paper_account = PaperTradingAccount.objects.filter(name="main").first()
	if paper_account:
		paper_account = _reset_paper_account_periods(paper_account)
	if paper_account and paper_account.risk_state == "restricted":
		analysis["execution_gate"]["allowed"] = False
		analysis["execution_gate"]["reason"] = "portfolio_risk_lock"
		analysis["reasoning"] = list(analysis.get("reasoning") or []) + [
			f"Portfolio risk lock active: daily/session risk threshold breached ({paper_account.daily_drawdown_pct}% daily, {paper_account.session_drawdown_pct}% session)."
		]
	prediction_id = None
	prediction_created = False
	if record_prediction:
		prediction, created = _record_market_prediction(analysis=analysis, market_name=analysis["market"])
		if prediction:
			prediction_id = prediction.id
			prediction_created = created

	analysis["prediction_id"] = prediction_id
	analysis["prediction_created"] = prediction_created
	analysis["resolved_pending_count"] = updated_outcomes
	analysis["provider_health_events"] = provider_health_events
	analysis["learning_summary"] = _build_learning_summary()
	analysis["disclaimer"] = (
		"This system provides automated technical analysis for research only and is not financial advice."
	)
	return JsonResponse({"ok": True, "analysis": analysis})


def market_backtest(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	symbol = request.GET.get("symbol", "").strip().upper()
	market = request.GET.get("market", "").strip().lower() or None
	interval = request.GET.get("interval", "15m").strip()
	provider = request.GET.get("provider", "auto").strip().lower()
	market_range = request.GET.get("range", "").strip() or None
	lookahead_raw = request.GET.get("lookahead", "24").strip()
	try:
		lookahead = max(4, min(120, int(lookahead_raw)))
	except ValueError:
		lookahead = 24

	if not symbol:
		return JsonResponse({"ok": False, "error": "symbol is required"}, status=400)

	try:
		fetch_result = fetch_candles_from_provider(
			symbol=symbol,
			interval=interval,
			market_range=market_range,
			market=market,
			provider=provider,
		)
	except MarketDataError as exc:
		return JsonResponse({"ok": False, "error": str(exc)}, status=502)

	candles = fetch_result.get("candles", [])
	if len(candles) < 90:
		return JsonResponse({"ok": False, "error": "Not enough candles for backtest"}, status=400)

	results = []
	for idx in range(80, len(candles) - 2):
		window = candles[: idx + 1]
		future = candles[idx + 1: idx + 1 + lookahead]
		if not future:
			break
		try:
			analysis = analyze_candles(window)
		except MarketDataError:
			continue

		outcome = _simulate_outcome(
			trend=analysis.get("trend"),
			stop_loss=analysis.get("stop_loss"),
			targets=analysis.get("targets") or {},
			future_candles=future,
		)
		results.append(
			{
				"time": window[-1].get("time"),
				"entry": analysis.get("entry"),
				"stop_loss": analysis.get("stop_loss"),
				"trend": analysis.get("trend"),
				"outcome": outcome,
			}
		)

	total = len(results)
	tp_hits = len([r for r in results if str(r["outcome"]).startswith("tp")])
	sl_hits = len([r for r in results if r["outcome"] == "sl"])
	pending = len([r for r in results if r["outcome"] == "pending"])
	resolved = total - pending
	win_rate = round((tp_hits / resolved) * 100, 2) if resolved else None

	return JsonResponse(
		{
			"ok": True,
			"symbol": symbol,
			"market": market,
			"interval": interval,
			"provider": fetch_result.get("provider_used") or provider,
			"lookahead": lookahead,
			"total": total,
			"resolved": resolved,
			"pending": pending,
			"tp_hits": tp_hits,
			"sl_hits": sl_hits,
			"win_rate": win_rate,
			"samples": results[-120:],
		}
	)


def market_provider_health_summary(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	provider = request.GET.get("provider", "").strip().lower()
	limit_raw = request.GET.get("limit", "200").strip()
	try:
		limit = max(10, min(1000, int(limit_raw)))
	except ValueError:
		limit = 200

	queryset = ProviderHealthEvent.objects.all()
	if provider and provider != "all":
		queryset = queryset.filter(provider=provider)

	items = list(queryset.values("provider", "ok", "latency_ms", "symbol", "market", "interval", "error", "created_at")[:limit])

	provider_map = {}
	for item in items:
		name = item["provider"]
		bucket = provider_map.setdefault(name, {"provider": name, "total": 0, "ok": 0, "fail": 0, "avg_latency_ms": 0, "last_error": ""})
		bucket["total"] += 1
		if item["ok"]:
			bucket["ok"] += 1
		else:
			bucket["fail"] += 1
			if item.get("error"):
				bucket["last_error"] = item.get("error")
		bucket["avg_latency_ms"] += int(item.get("latency_ms") or 0)

	for bucket in provider_map.values():
		if bucket["total"]:
			bucket["avg_latency_ms"] = round(bucket["avg_latency_ms"] / bucket["total"], 2)
			bucket["success_rate"] = round((bucket["ok"] / bucket["total"]) * 100, 2)
		else:
			bucket["success_rate"] = None

	return JsonResponse({"ok": True, "count": len(items), "providers": list(provider_map.values()), "events": items[:120]})


def market_alert_logs(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	limit_raw = request.GET.get("limit", "120").strip()
	try:
		limit = max(1, min(500, int(limit_raw)))
	except ValueError:
		limit = 120

	items = list(
		AlertDeliveryLog.objects.values(
			"id",
			"channel",
			"status",
			"message",
			"error",
			"created_at",
			"prediction_id",
		)[:limit]
	)
	return JsonResponse({"ok": True, "count": len(items), "items": items})


def market_prediction_history(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	limit_raw = request.GET.get("limit", "120").strip()
	try:
		limit = max(1, min(500, int(limit_raw)))
	except ValueError:
		limit = 120

	queryset = MarketPrediction.objects.all()
	symbol = request.GET.get("symbol", "").strip().upper()
	market = request.GET.get("market", "").strip().lower()
	interval = request.GET.get("interval", "").strip()
	provider = request.GET.get("provider", "").strip().lower()
	outcome = request.GET.get("outcome", "").strip().lower()

	if symbol:
		queryset = queryset.filter(symbol=symbol)
	if market:
		queryset = queryset.filter(market=market)
	if interval and interval != "all":
		queryset = queryset.filter(interval=interval)
	if provider and provider != "all":
		queryset = queryset.filter(provider=provider)
	if outcome and outcome != "all":
		queryset = queryset.filter(outcome=outcome)

	items = list(
		queryset.values(
			"id",
			"market",
			"symbol",
			"interval",
			"provider",
			"provider_label",
			"symbol_resolved",
			"trend",
			"entry",
			"stop_loss",
			"t1",
			"t2",
			"t3",
			"t4",
			"price_at_call",
			"latest_price",
			"outcome",
			"resolved_at",
			"resolved_price",
			"created_at",
			"metadata",
		)[:limit]
	)
	return JsonResponse({"ok": True, "count": len(items), "items": items})


def market_prediction_stats(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	queryset = MarketPrediction.objects.all()
	symbol = request.GET.get("symbol", "").strip().upper()
	market = request.GET.get("market", "").strip().lower()
	interval = request.GET.get("interval", "").strip()
	provider = request.GET.get("provider", "").strip().lower()

	if symbol:
		queryset = queryset.filter(symbol=symbol)
	if market:
		queryset = queryset.filter(market=market)
	if interval and interval != "all":
		queryset = queryset.filter(interval=interval)
	if provider and provider != "all":
		queryset = queryset.filter(provider=provider)

	total = queryset.count()
	pending = queryset.filter(outcome=MarketPrediction.Outcome.PENDING).count()
	resolved_qs = queryset.exclude(outcome=MarketPrediction.Outcome.PENDING)
	resolved = resolved_qs.count()
	sl_hits = queryset.filter(outcome=MarketPrediction.Outcome.SL).count()
	tp_hits = queryset.filter(outcome__in=[
		MarketPrediction.Outcome.TP1,
		MarketPrediction.Outcome.TP2,
		MarketPrediction.Outcome.TP3,
		MarketPrediction.Outcome.TP4,
	]).count()
	win_rate = round((tp_hits / resolved) * 100, 2) if resolved else None

	by_interval = list(queryset.values_list("interval", flat=True).distinct())

	# Replace rough pending count with exact counts per interval for clarity.
	interval_rows = []
	for iv in by_interval:
		iv_qs = queryset.filter(interval=iv)
		iv_total = iv_qs.count()
		iv_pending = iv_qs.filter(outcome=MarketPrediction.Outcome.PENDING).count()
		iv_resolved = iv_qs.exclude(outcome=MarketPrediction.Outcome.PENDING).count()
		iv_tp = iv_qs.filter(outcome__in=[
			MarketPrediction.Outcome.TP1,
			MarketPrediction.Outcome.TP2,
			MarketPrediction.Outcome.TP3,
			MarketPrediction.Outcome.TP4,
		]).count()
		iv_sl = iv_qs.filter(outcome=MarketPrediction.Outcome.SL).count()
		iv_win = round((iv_tp / iv_resolved) * 100, 2) if iv_resolved else None
		interval_rows.append(
			{
				"interval": iv,
				"total": iv_total,
				"pending": iv_pending,
				"resolved": iv_resolved,
				"tp_hits": iv_tp,
				"sl_hits": iv_sl,
				"win_rate": iv_win,
			}
		)

	return JsonResponse(
		{
			"ok": True,
			"total": total,
			"pending": pending,
			"resolved": resolved,
			"tp_hits": tp_hits,
			"sl_hits": sl_hits,
			"win_rate": win_rate,
			"by_interval": interval_rows,
			"learning": _build_learning_summary(),
		}
	)


def market_learning_insights(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])

	queryset = TradeLearningSnapshot.objects.all()
	symbol = request.GET.get("symbol", "").strip().upper()
	interval = request.GET.get("interval", "").strip()
	outcome = request.GET.get("outcome", "").strip().lower()
	if symbol:
		queryset = queryset.filter(symbol=symbol)
	if interval and interval != "all":
		queryset = queryset.filter(interval=interval)
	if outcome and outcome != "all":
		queryset = queryset.filter(outcome=outcome)
	summary = _build_learning_summary(queryset=queryset)
	items = list(
		queryset.values(
			"id",
			"symbol",
			"interval",
			"outcome",
			"confidence_score",
			"risk_reward_ratio",
			"stop_distance_pct",
			"root_causes",
			"tp_drivers",
			"learning_features",
			"created_at",
		)[:120]
	)
	return JsonResponse({"ok": True, "summary": summary, "items": items})


def market_paper_account(request):
	if request.method != "GET":
		return HttpResponseNotAllowed(["GET"])
	account, _ = PaperTradingAccount.objects.get_or_create(name="main")
	account = _reset_paper_account_periods(account)
	return JsonResponse({
		"ok": True,
		"account": {
			"name": account.name,
			"balance": account.balance,
			"equity": account.equity,
			"peak_equity": account.peak_equity,
			"max_drawdown_pct": account.max_drawdown_pct,
			"max_risk_per_trade_pct": account.max_risk_per_trade_pct,
			"max_daily_drawdown_pct": account.max_daily_drawdown_pct,
			"max_session_drawdown_pct": account.max_session_drawdown_pct,
			"daily_drawdown_pct": account.daily_drawdown_pct,
			"session_drawdown_pct": account.session_drawdown_pct,
			"daily_start_equity": account.daily_start_equity,
			"session_start_equity": account.session_start_equity,
			"last_risk_reset_at": account.last_risk_reset_at.isoformat() if account.last_risk_reset_at else None,
			"risk_state": account.risk_state,
			"win_count": account.win_count,
			"loss_count": account.loss_count,
			"trade_count": account.trade_count,
			"stats": account.stats,
		}
	})


@csrf_exempt
def market_prediction_clear(request):
	if request.method not in ("POST", "DELETE"):
		return HttpResponseNotAllowed(["POST", "DELETE"])

	queryset = MarketPrediction.objects.all()
	symbol = request.GET.get("symbol", "").strip().upper()
	market = request.GET.get("market", "").strip().lower()
	interval = request.GET.get("interval", "").strip()
	outcome = request.GET.get("outcome", "").strip().lower()

	if symbol:
		queryset = queryset.filter(symbol=symbol)
	if market:
		queryset = queryset.filter(market=market)
	if interval and interval != "all":
		queryset = queryset.filter(interval=interval)
	if outcome and outcome != "all":
		queryset = queryset.filter(outcome=outcome)

	deleted_count, _ = queryset.delete()
	return JsonResponse({"ok": True, "deleted": deleted_count})


@csrf_exempt
def market_analyze_all(request):
	if request.method not in ("GET", "POST"):
		return HttpResponseNotAllowed(["GET", "POST"])

	interval = request.GET.get("interval", "15m").strip() if request.method == "GET" else "15m"
	market_range = request.GET.get("range", "").strip() if request.method == "GET" else ""
	provider = request.GET.get("provider", "auto").strip().lower() if request.method == "GET" else "auto"

	if request.method == "POST":
		try:
			payload = json.loads(request.body.decode("utf-8"))
		except (json.JSONDecodeError, UnicodeDecodeError):
			return JsonResponse({"ok": False, "error": "Invalid JSON payload."}, status=400)
		interval = str(payload.get("interval", interval)).strip() or "15m"
		market_range = str(payload.get("range", market_range)).strip()
		provider = str(payload.get("provider", provider)).strip().lower() or "auto"
		custom_symbols = payload.get("symbols")
		if isinstance(custom_symbols, dict):
			markets = {
				k.lower(): [str(s).upper() for s in v if str(s).strip()]
				for k, v in custom_symbols.items()
				if isinstance(v, list)
			}
		else:
			markets = MARKET_UNIVERSE
	else:
		markets = MARKET_UNIVERSE

	results = []
	failures = []
	provider_health_events = 0
	for market_name, symbols in markets.items():
		for symbol in symbols:
			try:
				analysis = analyze_market_symbol(
					symbol=symbol,
					interval=interval,
					market_range=market_range or None,
					market=market_name,
					provider=provider,
				)
				analysis["market"] = market_name
				provider_health_events += _log_provider_attempts(analysis=analysis, market_name=market_name)
				results.append(analysis)
			except MarketDataError as exc:
				failures.append({"market": market_name, "symbol": symbol, "error": str(exc)})

	return JsonResponse(
		{
			"ok": True,
			"interval": interval,
			"range": market_range or "auto",
			"provider": provider,
			"count": len(results),
			"results": results,
			"failures": failures,
			"provider_health_events": provider_health_events,
			"disclaimer": "Automated analysis and projections are probabilistic and not guaranteed.",
		}
	)


# ──────────────────────────────────────────────────────────────────────
# CREDIT CHECK VIEWS
# ──────────────────────────────────────────────────────────────────────

from .models import Debtor, Debt


def credit_check_portal(request):
	return render(request, "core/credit_check.html")


@csrf_exempt
def credit_check_lookup(request):
	"""Look up a debtor by ID number OR first_name + last_name."""
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])

	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

	id_number = str(payload.get("id_number", "")).strip()
	first_name = str(payload.get("first_name", "")).strip()
	last_name = str(payload.get("last_name", "")).strip()

	if not id_number and not (first_name or last_name):
		return JsonResponse({"ok": False, "error": "Provide id_number or name/surname."}, status=400)

	qs = Debtor.objects.prefetch_related("debts")

	if id_number:
		qs = qs.filter(id_number=id_number)
	else:
		q = Q()
		if first_name:
			q &= Q(first_name__icontains=first_name)
		if last_name:
			q &= Q(last_name__icontains=last_name)
		qs = qs.filter(q)

	results = []
	for debtor in qs:
		debts = []
		for d in debtor.debts.all():
			debts.append({
				"id": d.id,
				"creditor": d.creditor,
				"debt_type": d.get_debt_type_display(),
				"original_amount": str(d.original_amount),
				"outstanding_balance": str(d.outstanding_balance),
				"monthly_installment": str(d.monthly_installment),
				"interest_rate": str(d.interest_rate),
				"due_date": str(d.due_date) if d.due_date else None,
				"status": d.get_status_display(),
				"months_overdue": d.months_overdue,
				"reference": d.reference,
				"notes": d.notes,
			})
		results.append({
			"debtor_id": debtor.id,
			"full_name": debtor.full_name,
			"first_name": debtor.first_name,
			"last_name": debtor.last_name,
			"id_number": debtor.id_number,
			"phone": debtor.phone,
			"email": debtor.email,
			"address": debtor.address,
			"total_outstanding": str(debtor.total_outstanding),
			"debts": debts,
		})

	if not results:
		return JsonResponse({"ok": True, "found": False, "results": []})

	return JsonResponse({"ok": True, "found": True, "results": results})


@csrf_exempt
def credit_check_add_debtor(request):
	"""Add a new debtor record (admin use)."""
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])

	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

	first_name = str(payload.get("first_name", "")).strip()
	last_name = str(payload.get("last_name", "")).strip()
	id_number = str(payload.get("id_number", "")).strip()

	if not first_name or not last_name or not id_number:
		return JsonResponse({"ok": False, "error": "first_name, last_name, and id_number are required."}, status=400)

	if len(id_number) != 13 or not id_number.isdigit():
		return JsonResponse({"ok": False, "error": "id_number must be exactly 13 digits."}, status=400)

	if Debtor.objects.filter(id_number=id_number).exists():
		return JsonResponse({"ok": False, "error": "A debtor with this ID number already exists."}, status=409)

	debtor = Debtor.objects.create(
		first_name=first_name,
		last_name=last_name,
		id_number=id_number,
		phone=str(payload.get("phone", "")).strip(),
		email=str(payload.get("email", "")).strip(),
		address=str(payload.get("address", "")).strip(),
		notes=str(payload.get("notes", "")).strip(),
	)

	return JsonResponse({"ok": True, "debtor_id": debtor.id, "full_name": debtor.full_name})


@csrf_exempt
def credit_check_add_debt(request):
	"""Add a debt record to an existing debtor."""
	if request.method != "POST":
		return HttpResponseNotAllowed(["POST"])

	try:
		payload = json.loads(request.body.decode("utf-8"))
	except (json.JSONDecodeError, UnicodeDecodeError):
		return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

	debtor_id = payload.get("debtor_id")
	try:
		debtor = Debtor.objects.get(pk=debtor_id)
	except Debtor.DoesNotExist:
		return JsonResponse({"ok": False, "error": "Debtor not found."}, status=404)

	creditor = str(payload.get("creditor", "")).strip()
	if not creditor:
		return JsonResponse({"ok": False, "error": "creditor is required."}, status=400)

	try:
		from decimal import Decimal as D
		original_amount = D(str(payload.get("original_amount", 0)))
		outstanding_balance = D(str(payload.get("outstanding_balance", original_amount)))
		monthly_installment = D(str(payload.get("monthly_installment", 0)))
		interest_rate = D(str(payload.get("interest_rate", 0)))
	except Exception:
		return JsonResponse({"ok": False, "error": "Invalid numeric value."}, status=400)

	due_date_str = str(payload.get("due_date", "")).strip() or None
	due_date = None
	if due_date_str:
		try:
			from datetime import date
			due_date = date.fromisoformat(due_date_str)
		except ValueError:
			return JsonResponse({"ok": False, "error": "due_date must be YYYY-MM-DD."}, status=400)

	debt_type = str(payload.get("debt_type", "other")).strip()
	valid_types = [c[0] for c in Debt.DebtType.choices]
	if debt_type not in valid_types:
		debt_type = "other"

	status = str(payload.get("status", "current")).strip()
	valid_statuses = [c[0] for c in Debt.Status.choices]
	if status not in valid_statuses:
		status = "current"

	debt = Debt.objects.create(
		debtor=debtor,
		creditor=creditor,
		debt_type=debt_type,
		original_amount=original_amount,
		outstanding_balance=outstanding_balance,
		monthly_installment=monthly_installment,
		interest_rate=interest_rate,
		due_date=due_date,
		status=status,
		months_overdue=int(payload.get("months_overdue", 0)),
		reference=str(payload.get("reference", "")).strip(),
		notes=str(payload.get("notes", "")).strip(),
	)

	return JsonResponse({"ok": True, "debt_id": debt.id, "debtor": debtor.full_name, "creditor": debt.creditor})
