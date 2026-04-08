import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.core.management.base import BaseCommand

from core.models import ProviderIntegration


class Command(BaseCommand):
    help = "Run a lightweight connectivity probe against the configured Betway provider endpoint."

    def add_arguments(self, parser):
        parser.add_argument(
            "--timeout",
            type=int,
            default=20,
            help="Probe timeout in seconds.",
        )

    def handle(self, *args, **options):
        integration = ProviderIntegration.objects.filter(provider_slug="betway", is_active=True).first()
        if not integration:
            self.stdout.write(self.style.ERROR("No active Betway integration found. Run manage.py connect_betway_provider first."))
            return

        if integration.mode != ProviderIntegration.Mode.LIVE:
            self.stdout.write(self.style.WARNING("Betway integration is in mock mode. Switch to live mode before probing."))
            return

        if not integration.endpoint:
            self.stdout.write(self.style.ERROR("Betway endpoint is missing."))
            return

        payload = {
            "probe": True,
            "provider": "betway",
            "message": "connectivity-check",
        }
        body = json.dumps(payload).encode("utf-8")
        request = Request(integration.endpoint, data=body, method="POST")
        request.add_header("Content-Type", "application/json")

        if integration.api_key:
            if integration.auth_scheme == ProviderIntegration.AuthScheme.HEADER:
                request.add_header(integration.auth_header or "X-API-Key", integration.api_key)
            elif integration.auth_scheme == ProviderIntegration.AuthScheme.BEARER:
                request.add_header(integration.auth_header or "Authorization", f"Bearer {integration.api_key}")

        timeout = max(5, min(int(options.get("timeout") or 20), 90))

        try:
            with urlopen(request, timeout=timeout) as response:
                status = response.status
                raw = response.read().decode("utf-8", errors="ignore")
                self.stdout.write(self.style.SUCCESS(f"Betway probe HTTP status: {status}"))
                if raw:
                    self.stdout.write(raw[:400])
        except HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="ignore")
            self.stdout.write(self.style.ERROR(f"Betway probe failed with HTTP {exc.code}"))
            if raw:
                self.stdout.write(raw[:400])
        except URLError as exc:
            self.stdout.write(self.style.ERROR(f"Betway probe connection error: {exc.reason}"))
