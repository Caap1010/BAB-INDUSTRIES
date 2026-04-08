import os
import sys
from pathlib import Path

from django.core.asgi import get_asgi_application

BASE_DIR = Path(__file__).resolve().parent.parent
MARKET_ANALYSIS_DIR = BASE_DIR / "Market Analysis"
if MARKET_ANALYSIS_DIR.exists():
	sys.path.insert(0, str(MARKET_ANALYSIS_DIR))

from market_analysis.ws_market_stream import handle_market_stream_websocket

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

django_asgi_app = get_asgi_application()


async def application(scope, receive, send):
	if scope["type"] == "websocket":
		if scope.get("path") == "/ws/market/stream/":
			await handle_market_stream_websocket(scope, receive, send)
			return
		await send({"type": "websocket.close", "code": 4404})
		return

	await django_asgi_app(scope, receive, send)
