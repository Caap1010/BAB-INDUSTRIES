import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class MarketProviderError(Exception):
    pass


@dataclass
class ProviderMeta:
    id: str
    label: str
    supports: tuple[str, ...]
    notes: str


def _to_iso(timestamp):
    return datetime.fromtimestamp(int(timestamp), tz=timezone.utc).isoformat()


def _coerce_candle(ts, open_, high, low, close, volume):
    return {
        "time": _to_iso(ts),
        "open": float(open_),
        "high": float(high),
        "low": float(low),
        "close": float(close),
        "volume": int(float(volume)) if volume is not None else 0,
    }


def _load_json(url, timeout=20):
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json,text/plain,*/*",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _normalize_market_symbol_for_binance(symbol):
    s = (symbol or "").upper().replace("-", "")
    if s.endswith("USD"):
        return f"{s[:-3]}USDT"
    if s.endswith("USDT"):
        return s
    return f"{s}USDT"


def _normalize_market_symbol_for_yahoo(symbol):
    raw = (symbol or "").strip().upper()
    aliases = {
        "NAS100": "NQ=F",
        "US100": "NQ=F",
        "XAUUSD": "GC=F",
        "GOLD": "GC=F",
    }
    if raw in aliases:
        return aliases[raw]
    return symbol


class BaseMarketProvider:
    meta = ProviderMeta("base", "Base", (), "Base provider")

    def resolve_symbol(self, symbol, market=None):
        return symbol

    def fetch_live_quote(self, symbol, market=None):
        return None

    def fetch_candles(self, symbol, interval="15m", market_range=None, market=None):
        raise NotImplementedError


class YahooFinanceProvider(BaseMarketProvider):
    meta = ProviderMeta(
        id="yahoo",
        label="Yahoo Finance",
        supports=("indices", "stocks", "futures", "forex", "crypto"),
        notes="General multi-asset feed for broad coverage.",
    )

    _base_url = "https://query1.finance.yahoo.com/v8/finance/chart"
    _interval_to_range = {
        "1m": "1d",
        "2m": "1d",
        "5m": "5d",
        "15m": "5d",
        "30m": "1mo",
        "60m": "1mo",
        "90m": "1mo",
        "1h": "1mo",
        "1d": "1y",
        "1wk": "5y",
    }

    def resolve_symbol(self, symbol, market=None):
        return _normalize_market_symbol_for_yahoo(symbol)

    def fetch_candles(self, symbol, interval="15m", market_range=None, market=None):
        symbol = self.resolve_symbol(symbol, market=market)
        resolved_range = market_range or self._interval_to_range.get(interval, "5d")
        params = {
            "interval": interval,
            "range": resolved_range,
            "includePrePost": "true",
            "events": "div,splits",
        }
        request_url = f"{self._base_url}/{symbol}?{urlencode(params)}"

        try:
            payload = _load_json(request_url, timeout=20)
        except URLError as exc:
            raise MarketProviderError(f"Yahoo request failed for {symbol}: {exc}")

        result = payload.get("chart", {}).get("result")
        error = payload.get("chart", {}).get("error")
        if error:
            raise MarketProviderError(error.get("description") or f"No data available for {symbol}")
        if not result:
            raise MarketProviderError(f"No chart result returned for {symbol}")

        block = result[0]
        timestamps = block.get("timestamp", [])
        quote_list = block.get("indicators", {}).get("quote", [{}])
        quote = quote_list[0] if quote_list else {}
        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])
        closes = quote.get("close", [])
        volumes = quote.get("volume", [])

        candles = []
        for i, ts in enumerate(timestamps):
            if i >= len(closes):
                continue
            c = closes[i]
            h = highs[i] if i < len(highs) else None
            l = lows[i] if i < len(lows) else None
            o = opens[i] if i < len(opens) else None
            v = volumes[i] if i < len(volumes) else 0
            if c is None or h is None or l is None or o is None:
                continue
            candles.append(_coerce_candle(ts, o, h, l, c, v))

        if len(candles) < 60:
            raise MarketProviderError(f"Not enough candle data for {symbol} from Yahoo")

        return candles

    def fetch_live_quote(self, symbol, market=None):
        resolved = self.resolve_symbol(symbol, market=market)
        params = {
            "interval": "1m",
            "range": "1d",
            "includePrePost": "true",
            "events": "div,splits",
        }
        request_url = f"{self._base_url}/{resolved}?{urlencode(params)}"
        try:
            payload = _load_json(request_url, timeout=12)
        except URLError:
            return None

        result = payload.get("chart", {}).get("result")
        if not result:
            return None

        block = result[0]
        meta = block.get("meta", {}) or {}
        price = meta.get("regularMarketPrice")
        ts = meta.get("regularMarketTime")
        if price is None or ts is None:
            return None
        try:
            return {
                "price": float(price),
                "time": _to_iso(ts),
                "source": "yahoo_quote",
            }
        except Exception:
            return None


class BinanceProvider(BaseMarketProvider):
    meta = ProviderMeta(
        id="binance",
        label="Binance",
        supports=("crypto",),
        notes="Crypto klines from Binance spot market.",
    )

    _base_url = "https://api.binance.com/api/v3/klines"
    _ticker_url = "https://api.binance.com/api/v3/ticker/price"
    _interval_map = {
        "1m": "1m",
        "3m": "3m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "60m": "1h",
        "1h": "1h",
        "4h": "4h",
        "1d": "1d",
    }

    def resolve_symbol(self, symbol, market=None):
        return _normalize_market_symbol_for_binance(symbol)

    def fetch_candles(self, symbol, interval="15m", market_range=None, market=None):
        if market and market != "crypto":
            raise MarketProviderError("Binance provider supports crypto market only")

        kl_interval = self._interval_map.get(interval, "15m")
        limit = 500
        binance_symbol = self.resolve_symbol(symbol, market=market)

        params = {"symbol": binance_symbol, "interval": kl_interval, "limit": str(limit)}
        request_url = f"{self._base_url}?{urlencode(params)}"

        try:
            payload = _load_json(request_url, timeout=20)
        except URLError as exc:
            raise MarketProviderError(f"Binance request failed for {symbol}: {exc}")

        if not isinstance(payload, list):
            msg = payload.get("msg") if isinstance(payload, dict) else "Unexpected Binance response"
            raise MarketProviderError(str(msg))

        candles = []
        for item in payload:
            if len(item) < 6:
                continue
            open_time = int(item[0]) // 1000
            open_ = item[1]
            high = item[2]
            low = item[3]
            close = item[4]
            volume = item[5]
            candles.append(_coerce_candle(open_time, open_, high, low, close, volume))

        if len(candles) < 60:
            raise MarketProviderError(f"Not enough candle data for {symbol} from Binance")

        return candles

    def fetch_live_quote(self, symbol, market=None):
        try:
            pair = self.resolve_symbol(symbol, market=market)
            request_url = f"{self._ticker_url}?{urlencode({'symbol': pair})}"
            payload = _load_json(request_url, timeout=10)
            price = payload.get("price") if isinstance(payload, dict) else None
            if price is None:
                return None
            return {
                "price": float(price),
                "time": datetime.now(timezone.utc).isoformat(),
                "source": "binance_ticker",
            }
        except Exception:
            return None


class AlphaVantageProvider(BaseMarketProvider):
    meta = ProviderMeta(
        id="alpha_vantage",
        label="Alpha Vantage",
        supports=("stocks", "forex", "crypto"),
        notes="Requires ALPHAVANTAGE_API_KEY; currently enabled as extension point.",
    )

    def fetch_candles(self, symbol, interval="15m", market_range=None, market=None):
        api_key = os.getenv("ALPHAVANTAGE_API_KEY", "").strip()
        if not api_key:
            raise MarketProviderError("ALPHAVANTAGE_API_KEY is not configured")
        raise MarketProviderError("Alpha Vantage adapter stub is configured but not fully mapped yet")


class PolygonProvider(BaseMarketProvider):
    meta = ProviderMeta(
        id="polygon",
        label="Polygon",
        supports=("stocks", "indices", "forex", "crypto"),
        notes="Requires POLYGON_API_KEY; currently enabled as extension point.",
    )

    def fetch_candles(self, symbol, interval="15m", market_range=None, market=None):
        api_key = os.getenv("POLYGON_API_KEY", "").strip()
        if not api_key:
            raise MarketProviderError("POLYGON_API_KEY is not configured")
        raise MarketProviderError("Polygon adapter stub is configured but not fully mapped yet")


class OandaProvider(BaseMarketProvider):
    meta = ProviderMeta(
        id="oanda",
        label="OANDA",
        supports=("forex",),
        notes="Requires OANDA_API_TOKEN; currently enabled as extension point.",
    )

    def fetch_candles(self, symbol, interval="15m", market_range=None, market=None):
        token = os.getenv("OANDA_API_TOKEN", "").strip()
        if not token:
            raise MarketProviderError("OANDA_API_TOKEN is not configured")
        raise MarketProviderError("OANDA adapter stub is configured but not fully mapped yet")


class BrokerBridgeProvider(BaseMarketProvider):
    meta = ProviderMeta(
        id="broker_bridge",
        label="Broker Bridge",
        supports=("indices", "stocks", "futures", "forex", "crypto"),
        notes="Optional broker-grade bridge feed via BROKER_BRIDGE_URL.",
    )

    _interval_alias = {
        "60m": "1h",
        "1h": "1h",
        "1d": "1d",
    }

    def _endpoint(self):
        return os.getenv("BROKER_BRIDGE_URL", "").strip()

    def resolve_symbol(self, symbol, market=None):
        aliases = {
            "NAS100": os.getenv("BROKER_NAS100_SYMBOL", "US100").strip() or "US100",
            "US100": os.getenv("BROKER_NAS100_SYMBOL", "US100").strip() or "US100",
            "XAUUSD": os.getenv("BROKER_XAUUSD_SYMBOL", "XAUUSD").strip() or "XAUUSD",
        }
        return aliases.get((symbol or "").upper(), symbol)

    def fetch_candles(self, symbol, interval="15m", market_range=None, market=None):
        endpoint = self._endpoint()
        if not endpoint:
            raise MarketProviderError("BROKER_BRIDGE_URL is not configured")

        resolved_symbol = self.resolve_symbol(symbol, market=market)
        params = {
            "symbol": resolved_symbol,
            "interval": self._interval_alias.get(interval, interval),
            "range": market_range or "5d",
            "market": market or "",
        }
        request_url = f"{endpoint}?{urlencode(params)}"
        token = os.getenv("BROKER_BRIDGE_TOKEN", "").strip()
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json,text/plain,*/*",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        request = Request(request_url, headers=headers)
        try:
            with urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise MarketProviderError(f"Broker bridge request failed for {resolved_symbol}: {exc}")

        raw_candles = payload.get("candles", payload if isinstance(payload, list) else [])
        if not isinstance(raw_candles, list):
            raise MarketProviderError("Broker bridge returned invalid candle payload")

        def parse_ts(value):
            if isinstance(value, (int, float)):
                raw = int(value)
                if raw > 10_000_000_000:
                    raw //= 1000
                return datetime.fromtimestamp(raw, tz=timezone.utc)
            if isinstance(value, str):
                text = value.replace("Z", "+00:00")
                return datetime.fromisoformat(text)
            raise ValueError("Unsupported timestamp format")

        candles = []
        for item in raw_candles:
            if not isinstance(item, dict):
                continue
            try:
                dt = parse_ts(item.get("time") or item.get("timestamp") or item.get("t"))
                candles.append(
                    {
                        "time": dt.astimezone(timezone.utc).isoformat(),
                        "open": float(item.get("open", item.get("o"))),
                        "high": float(item.get("high", item.get("h"))),
                        "low": float(item.get("low", item.get("l"))),
                        "close": float(item.get("close", item.get("c"))),
                        "volume": int(float(item.get("volume", item.get("v", 0)) or 0)),
                    }
                )
            except Exception:
                continue

        candles.sort(key=lambda c: c.get("time", ""))
        if len(candles) < 60:
            raise MarketProviderError(f"Not enough candle data for {resolved_symbol} from broker bridge")
        return candles


_PROVIDERS = {
    "broker_bridge": BrokerBridgeProvider(),
    "yahoo": YahooFinanceProvider(),
    "binance": BinanceProvider(),
    "alpha_vantage": AlphaVantageProvider(),
    "polygon": PolygonProvider(),
    "oanda": OandaProvider(),
}


def get_supported_providers(market=None):
    out = []
    for provider in _PROVIDERS.values():
        if market and market not in provider.meta.supports:
            continue
        out.append(
            {
                "id": provider.meta.id,
                "label": provider.meta.label,
                "supports": list(provider.meta.supports),
                "notes": provider.meta.notes,
            }
        )
    return out


def resolve_provider(provider_name="auto", market=None):
    requested = (provider_name or "auto").strip().lower()
    if requested != "auto":
        provider = _PROVIDERS.get(requested)
        if not provider:
            raise MarketProviderError(f"Unsupported provider: {requested}")
        if market and market not in provider.meta.supports:
            raise MarketProviderError(f"Provider '{requested}' does not support market '{market}'")
        return provider

    if market == "crypto":
        return _PROVIDERS["binance"]
    return _PROVIDERS["yahoo"]


def resolve_provider_candidates(provider_name="auto", market=None):
    requested = (provider_name or "auto").strip().lower()
    if requested != "auto":
        return [resolve_provider(provider_name=requested, market=market)]

    if market == "crypto":
        return [_PROVIDERS["binance"], _PROVIDERS["yahoo"]]

    if market in ("indices", "futures", "forex", "stocks"):
        return [_PROVIDERS["broker_bridge"], _PROVIDERS["yahoo"]]

    return [_PROVIDERS["yahoo"]]
