import sys
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MARKET_ANALYSIS_DIR = BASE_DIR / "Market Analysis"

if MARKET_ANALYSIS_DIR.exists():
    sys.path.insert(0, str(MARKET_ANALYSIS_DIR))

SECRET_KEY = "django-insecure-bab-industries-pest-control"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "core.cors_headers.MarketApiCorsHeadersMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates", MARKET_ANALYSIS_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Johannesburg"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Persist generated CAP Anime Studio image/video assets so recents survive browser sessions.
CAP_ANIME_MEDIA_ROOT = BASE_DIR / "generated_media" / "cap_anime"

# Provider integration hooks for voucher catalog fulfillment.
# Keys are lowercase provider slugs, for example: betway, hollywoodbets, mtn.
VOUCHER_PROVIDER_ENDPOINTS = {
    "betway": os.getenv("BETWAY_PROVIDER_ENDPOINT", "").strip(),
}
VOUCHER_PROVIDER_API_KEYS = {
    "betway": os.getenv("BETWAY_PROVIDER_API_KEY", "").strip(),
}

# Optional provider connection defaults used by the gateway/integration tooling.
VOUCHER_PROVIDER_AUTH_SCHEMES = {
    "betway": os.getenv("BETWAY_PROVIDER_AUTH_SCHEME", "bearer").strip().lower() or "bearer",
}
VOUCHER_PROVIDER_AUTH_HEADERS = {
    "betway": os.getenv("BETWAY_PROVIDER_AUTH_HEADER", "Authorization").strip() or "Authorization",
}

# Optional webhook verification secret for Betway callbacks.
BETWAY_PROVIDER_WEBHOOK_SECRET = os.getenv("BETWAY_PROVIDER_WEBHOOK_SECRET", "").strip()
