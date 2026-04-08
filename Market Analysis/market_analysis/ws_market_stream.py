import asyncio
import json
from urllib.parse import parse_qs

from .market_analysis import MARKET_UNIVERSE, MarketDataError, analyze_market_symbol


def _first(query_params, key, default=""):
    values = query_params.get(key, [default])
    if not values:
        return default
    return values[0]


def _default_symbol_for_market(market):
    symbols = MARKET_UNIVERSE.get(market, [])
    return symbols[0] if symbols else "BTC-USD"


async def _safe_analyze(symbol, market, interval, market_range, provider):
    try:
        analysis = await asyncio.to_thread(
            analyze_market_symbol,
            symbol,
            interval,
            market_range or None,
            market,
            provider,
            False,
        )
        analysis["market"] = market
        return {"ok": True, "type": "analysis", "analysis": analysis}
    except MarketDataError as exc:
        return {"ok": False, "type": "error", "error": str(exc), "symbol": symbol, "market": market}


async def handle_market_stream_websocket(scope, receive, send):
    query_params = parse_qs((scope.get("query_string") or b"").decode("utf-8"))
    market = _first(query_params, "market", "crypto").strip().lower()
    interval = _first(query_params, "interval", "15m").strip()
    market_range = _first(query_params, "range", "").strip()
    provider = _first(query_params, "provider", "auto").strip().lower()
    symbol = _first(query_params, "symbol", _default_symbol_for_market(market)).strip().upper()

    refresh_raw = _first(query_params, "refresh", "6").strip()
    try:
        refresh_seconds = max(2, min(60, int(refresh_raw)))
    except ValueError:
        refresh_seconds = 6

    await send({"type": "websocket.accept"})

    async def _send_json(payload):
        await send({"type": "websocket.send", "text": json.dumps(payload)})

    await _send_json(
        {
            "ok": True,
            "type": "connected",
            "symbol": symbol,
            "market": market,
            "interval": interval,
            "range": market_range or "auto",
            "provider": provider,
            "refresh": refresh_seconds,
        }
    )

    while True:
        await _send_json(await _safe_analyze(symbol, market, interval, market_range, provider))

        try:
            incoming = await asyncio.wait_for(receive(), timeout=refresh_seconds)
        except asyncio.TimeoutError:
            continue

        message_type = incoming.get("type")
        if message_type == "websocket.disconnect":
            break

        if message_type != "websocket.receive":
            continue

        text_data = incoming.get("text")
        if not text_data:
            continue

        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await _send_json({"ok": False, "type": "error", "error": "Invalid websocket JSON message"})
            continue

        action = str(payload.get("action", "update")).strip().lower()
        if action == "stop":
            await _send_json({"ok": True, "type": "stopped"})
            break

        symbol = str(payload.get("symbol", symbol)).strip().upper()
        market = str(payload.get("market", market)).strip().lower()
        interval = str(payload.get("interval", interval)).strip()
        market_range = str(payload.get("range", market_range)).strip()
        provider = str(payload.get("provider", provider)).strip().lower()

        refresh_msg = payload.get("refresh", refresh_seconds)
        try:
            refresh_seconds = max(2, min(60, int(refresh_msg)))
        except (TypeError, ValueError):
            pass

        await _send_json(
            {
                "ok": True,
                "type": "updated",
                "symbol": symbol,
                "market": market,
                "interval": interval,
                "range": market_range or "auto",
                "provider": provider,
                "refresh": refresh_seconds,
            }
        )

    await send({"type": "websocket.close", "code": 1000})
