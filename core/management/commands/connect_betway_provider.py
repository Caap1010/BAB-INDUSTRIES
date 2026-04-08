import os

from django.conf import settings
from django.core.management.base import BaseCommand

from core.models import ProviderIntegration


class Command(BaseCommand):
    help = "Create or update the Betway provider integration from environment/config."

    def add_arguments(self, parser):
        parser.add_argument(
            "--live",
            action="store_true",
            help="Force live mode if endpoint and API key are set.",
        )
        parser.add_argument(
            "--mock",
            action="store_true",
            help="Force mock mode regardless of endpoint/API key.",
        )

    def handle(self, *args, **options):
        endpoint = (
            os.getenv("BETWAY_PROVIDER_ENDPOINT", "").strip()
            or str(getattr(settings, "VOUCHER_PROVIDER_ENDPOINTS", {}).get("betway", "")).strip()
        )
        api_key = (
            os.getenv("BETWAY_PROVIDER_API_KEY", "").strip()
            or str(getattr(settings, "VOUCHER_PROVIDER_API_KEYS", {}).get("betway", "")).strip()
        )
        auth_scheme = (
            os.getenv("BETWAY_PROVIDER_AUTH_SCHEME", "").strip().lower()
            or str(getattr(settings, "VOUCHER_PROVIDER_AUTH_SCHEMES", {}).get("betway", "bearer")).strip().lower()
            or "bearer"
        )
        auth_header = (
            os.getenv("BETWAY_PROVIDER_AUTH_HEADER", "").strip()
            or str(getattr(settings, "VOUCHER_PROVIDER_AUTH_HEADERS", {}).get("betway", "Authorization")).strip()
            or "Authorization"
        )
        webhook_secret = (
            os.getenv("BETWAY_PROVIDER_WEBHOOK_SECRET", "").strip()
            or str(getattr(settings, "BETWAY_PROVIDER_WEBHOOK_SECRET", "")).strip()
        )

        if options.get("mock"):
            mode = ProviderIntegration.Mode.MOCK
        elif options.get("live"):
            mode = ProviderIntegration.Mode.LIVE
        else:
            mode = ProviderIntegration.Mode.LIVE if endpoint and api_key else ProviderIntegration.Mode.MOCK

        integration, _ = ProviderIntegration.objects.update_or_create(
            provider_slug="betway",
            defaults={
                "display_name": "Betway",
                "mode": mode,
                "endpoint": endpoint,
                "api_key": api_key,
                "auth_scheme": auth_scheme,
                "auth_header": auth_header,
                "timeout_seconds": 25,
                "webhook_secret": webhook_secret,
                "is_active": True,
                "metadata": {
                    "managedBy": "connect_betway_provider",
                    "hasEndpoint": bool(endpoint),
                    "hasApiKey": bool(api_key),
                },
            },
        )

        self.stdout.write(self.style.SUCCESS("Betway integration updated."))
        self.stdout.write(f"provider_slug: {integration.provider_slug}")
        self.stdout.write(f"mode: {integration.mode}")
        self.stdout.write(f"endpoint_set: {bool(integration.endpoint)}")
        self.stdout.write(f"api_key_set: {bool(integration.api_key)}")
        self.stdout.write(f"auth_scheme: {integration.auth_scheme}")
        self.stdout.write(f"auth_header: {integration.auth_header}")
        self.stdout.write(f"webhook_secret_set: {bool(integration.webhook_secret)}")

        if integration.mode == ProviderIntegration.Mode.LIVE and (not integration.endpoint or not integration.api_key):
            self.stdout.write(
                self.style.WARNING(
                    "LIVE mode selected but endpoint/key are missing. Set BETWAY_PROVIDER_ENDPOINT and BETWAY_PROVIDER_API_KEY."
                )
            )
