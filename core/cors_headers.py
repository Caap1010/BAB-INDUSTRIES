from django.utils.deprecation import MiddlewareMixin
from django.http import HttpResponse


class MarketApiCorsHeadersMiddleware(MiddlewareMixin):
    """Allow local-browser access to market API endpoints across localhost ports."""

    ALLOWED_ORIGIN_PREFIXES = (
        "http://127.0.0.1",
        "http://localhost",
        "https://127.0.0.1",
        "https://localhost",
    )

    ALLOWED_PATH_PREFIXES = (
        "/api/market/",
        "/api/vouchers/",
    )

    def _should_apply(self, path):
        return any(path.startswith(prefix) for prefix in self.ALLOWED_PATH_PREFIXES)

    def _set_headers(self, request, response):
        origin = request.headers.get("Origin", "")
        allow_origin = "*"
        if origin and origin.startswith(self.ALLOWED_ORIGIN_PREFIXES):
            allow_origin = origin

        response["Access-Control-Allow-Origin"] = allow_origin
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, X-Requested-With"
        response["Access-Control-Allow-Credentials"] = "true"
        response["Vary"] = "Origin"
        return response

    def process_request(self, request):
        path = (request.path or "").lower()
        if not self._should_apply(path):
            return None

        if request.method == "OPTIONS":
            return self._set_headers(request, HttpResponse(status=200))

        return None

    def process_response(self, request, response):
        path = (request.path or "").lower()
        if not self._should_apply(path):
            return response

        return self._set_headers(request, response)
