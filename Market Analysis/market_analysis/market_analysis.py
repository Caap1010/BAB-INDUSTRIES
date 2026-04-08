from statistics import mean
from datetime import datetime, timezone
from time import perf_counter
import time
import copy

from .market_providers import MarketProviderError, resolve_provider_candidates

MARKET_UNIVERSE = {
    "indices": ["NAS100", "^GSPC", "^DJI", "^IXIC", "^FTSE", "^N225", "^VIX"],
    "stocks": ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL"],
    "futures": ["ES=F", "NQ=F", "YM=F", "CL=F", "GC=F", "SI=F"],
    "forex": ["XAUUSD", "EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X", "USDZAR=X"],
    "crypto": ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "BNB-USD"],
}

INTERVAL_TO_RANGE = {
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

HIGHER_TIMEFRAME_MAP = {
    "1m": "5m",
    "2m": "5m",
    "5m": "15m",
    "15m": "60m",
    "30m": "1d",
    "60m": "1d",
    "1h": "1d",
    "90m": "1d",
    "1d": "1wk",
}

_ANALYSIS_CACHE = {}
_ANALYSIS_CACHE_MAX_ITEMS = 300
_PROVIDER_COOLDOWN_UNTIL = {}
_PROVIDER_FAIL_COUNTS = {}
_PROVIDER_COOLDOWN_CAP_SECONDS = 60


def _cache_ttl_for_interval(interval):
    mapping = {
        "1m": 5,
        "2m": 6,
        "5m": 10,
        "15m": 20,
        "30m": 30,
        "60m": 45,
        "1h": 45,
        "90m": 60,
        "1d": 300,
        "1wk": 1800,
    }
    return mapping.get(interval, 20)


def _cache_key(symbol, interval, market_range, market, provider):
    return (
        (symbol or "").upper(),
        (interval or "15m").lower(),
        (market_range or "").lower(),
        (market or "").lower(),
        (provider or "auto").lower(),
    )


def _trim_cache_if_needed():
    if len(_ANALYSIS_CACHE) <= _ANALYSIS_CACHE_MAX_ITEMS:
        return
    oldest_key = min(_ANALYSIS_CACHE.items(), key=lambda item: item[1].get("created_at", 0))[0]
    _ANALYSIS_CACHE.pop(oldest_key, None)


def _provider_cooldown_key(provider_id, market, symbol):
    return f"{provider_id}|{(market or '').lower()}|{(symbol or '').upper()}"


def _provider_is_on_cooldown(provider_id, market, symbol):
    key = _provider_cooldown_key(provider_id, market, symbol)
    until = _PROVIDER_COOLDOWN_UNTIL.get(key, 0)
    return until > time.time()


def _provider_register_success(provider_id, market, symbol):
    key = _provider_cooldown_key(provider_id, market, symbol)
    _PROVIDER_FAIL_COUNTS[key] = 0
    _PROVIDER_COOLDOWN_UNTIL.pop(key, None)


def _provider_register_failure(provider_id, market, symbol):
    key = _provider_cooldown_key(provider_id, market, symbol)
    fail_count = int(_PROVIDER_FAIL_COUNTS.get(key, 0)) + 1
    _PROVIDER_FAIL_COUNTS[key] = fail_count
    cooldown = min(_PROVIDER_COOLDOWN_CAP_SECONDS, 5 * fail_count)
    _PROVIDER_COOLDOWN_UNTIL[key] = time.time() + cooldown
    return cooldown


class MarketDataError(Exception):
    pass


def fetch_candles(symbol, interval="15m", market_range=None):
    return fetch_candles_from_provider(
        symbol=symbol,
        interval=interval,
        market_range=market_range,
        market=None,
        provider="auto",
    )


def fetch_candles_from_provider(symbol, interval="15m", market_range=None, market=None, provider="auto"):
    engines = resolve_provider_candidates(provider_name=provider, market=market)
    last_error = None
    attempts = []
    engine_count = len(engines)
    for engine in engines:
        if engine_count > 1 and _provider_is_on_cooldown(engine.meta.id, market, symbol):
            attempts.append(
                {
                    "provider": engine.meta.id,
                    "label": engine.meta.label,
                    "symbol_resolved": engine.resolve_symbol(symbol=symbol, market=market),
                    "ok": False,
                    "latency_ms": 0,
                    "error": "provider on cooldown",
                }
            )
            continue

        start = perf_counter()
        resolved_symbol = engine.resolve_symbol(symbol=symbol, market=market)
        try:
            candles = engine.fetch_candles(
                symbol=symbol,
                interval=interval,
                market_range=market_range,
                market=market,
            )
            _provider_register_success(engine.meta.id, market, symbol)
            latency_ms = max(1, int((perf_counter() - start) * 1000))
            attempts.append(
                {
                    "provider": engine.meta.id,
                    "label": engine.meta.label,
                    "symbol_resolved": resolved_symbol,
                    "ok": True,
                    "latency_ms": latency_ms,
                    "error": None,
                }
            )

            failed_attempts = [item for item in attempts if not item.get("ok")]
            fallback_reason = "; ".join(
                f"{item.get('provider')}: {item.get('error')}" for item in failed_attempts if item.get("error")
            )
            return {
                "candles": candles,
                "provider_used": engine.meta.id,
                "provider_label": engine.meta.label,
                "symbol_requested": symbol,
                "symbol_resolved": resolved_symbol,
                "provider_notes": engine.meta.notes,
                "provider_attempts": attempts,
                "fallback_used": len(failed_attempts) > 0,
                "fallback_reason": fallback_reason or None,
            }
        except MarketProviderError as exc:
            last_error = str(exc)
            cooldown_seconds = _provider_register_failure(engine.meta.id, market, symbol)
            latency_ms = max(1, int((perf_counter() - start) * 1000))
            attempts.append(
                {
                    "provider": engine.meta.id,
                    "label": engine.meta.label,
                    "symbol_resolved": resolved_symbol,
                    "ok": False,
                    "latency_ms": latency_ms,
                    "error": f"{last_error} (cooldown {cooldown_seconds}s)",
                }
            )
            continue

    raise MarketDataError(last_error or "No provider could return market data")


def fetch_live_quote_from_provider(symbol, market=None, provider="auto"):
    engines = resolve_provider_candidates(provider_name=provider, market=market)
    for engine in engines:
        try:
            quote = engine.fetch_live_quote(symbol=symbol, market=market)
            if quote and quote.get("price") is not None:
                return {
                    "quote": quote,
                    "provider_used": engine.meta.id,
                }
        except Exception:
            continue
    return None


def _ema(values, period):
    if len(values) < period:
        return []
    multiplier = 2.0 / (period + 1)
    seed = mean(values[:period])
    output = [seed]
    for value in values[period:]:
        output.append((value - output[-1]) * multiplier + output[-1])
    return output


def _atr(candles, period=14):
    if len(candles) < period + 1:
        return None
    trs = []
    for i in range(1, len(candles)):
        curr = candles[i]
        prev_close = candles[i - 1]["close"]
        tr = max(
            curr["high"] - curr["low"],
            abs(curr["high"] - prev_close),
            abs(curr["low"] - prev_close),
        )
        trs.append(tr)
    if len(trs) < period:
        return None
    return sum(trs[-period:]) / period


def _linear_regression(points):
    if len(points) < 2:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    x_mean = mean(xs)
    y_mean = mean(ys)

    num = sum((x - x_mean) * (y - y_mean) for x, y in points)
    den = sum((x - x_mean) ** 2 for x in xs)
    if den == 0:
        return None

    slope = num / den
    intercept = y_mean - slope * x_mean
    return slope, intercept


def _find_pivots(candles, window=3, kind="low"):
    values = [c[kind] for c in candles]
    pivots = []
    for idx in range(window, len(values) - window):
        current = values[idx]
        left = values[idx - window: idx]
        right = values[idx + 1: idx + window + 1]

        if kind == "low":
            if current <= min(left) and current <= min(right):
                pivots.append((idx, current))
        else:
            if current >= max(left) and current >= max(right):
                pivots.append((idx, current))
    return pivots


def _line_value(line, x):
    if line is None:
        return None
    slope, intercept = line
    return slope * x + intercept


def _round_price(value):
    if value is None:
        return None
    if value >= 1000:
        return round(value, 2)
    if value >= 1:
        return round(value, 4)
    return round(value, 6)


def _series_slope(values):
    if len(values) < 5:
        return 0
    points = list(enumerate(values))
    line = _linear_regression(points)
    if not line:
        return 0
    return line[0]


def _build_reasoning(trend, close_now, ema_fast, ema_slow, slope_close, atr_value, support_now, resistance_now):
    reasons = []
    reasons.append(
        f"Price ({_round_price(close_now)}) vs EMA20 ({_round_price(ema_fast)}) and EMA50 ({_round_price(ema_slow)}) helps classify direction."
    )
    reasons.append(
        f"Recent regression slope of closes is {round(slope_close, 6)}, indicating momentum is {'upward' if slope_close > 0 else 'downward' if slope_close < 0 else 'flat'}."
    )
    if support_now is not None and resistance_now is not None:
        reasons.append(
            f"Derived support near {_round_price(support_now)} and resistance near {_round_price(resistance_now)} from pivot trendlines."
        )
    if atr_value is not None:
        reasons.append(
            f"ATR(14) is {_round_price(atr_value)}, used to size stop-loss buffer and target spacing."
        )
    if trend == "bullish":
        reasons.append("Bullish classification because fast trend structure and momentum both point upward.")
    elif trend == "bearish":
        reasons.append("Bearish classification because momentum and trend structure both point downward.")
    else:
        reasons.append("Sideways classification because trend and momentum are mixed or weak.")
    return reasons


def _entry_quality(trend, close_now, support_now, resistance_now, atr_value):
    if atr_value in (None, 0):
        return {"score": 50, "label": "neutral", "distance_to_structure": None}
    if trend == "bullish" and support_now is not None:
        distance = abs(close_now - support_now)
        score = 84 if distance <= atr_value * 0.75 else 68 if distance <= atr_value * 1.35 else 49
        label = "optimal_retest" if score >= 80 else "acceptable_pullback" if score >= 60 else "extended_entry"
        return {"score": score, "label": label, "distance_to_structure": _round_price(distance)}
    if trend == "bearish" and resistance_now is not None:
        distance = abs(resistance_now - close_now)
        score = 84 if distance <= atr_value * 0.75 else 68 if distance <= atr_value * 1.35 else 49
        label = "optimal_retest" if score >= 80 else "acceptable_pullback" if score >= 60 else "extended_entry"
        return {"score": score, "label": label, "distance_to_structure": _round_price(distance)}
    return {"score": 52, "label": "market_entry", "distance_to_structure": None}


def _higher_timeframe_interval(interval):
    return HIGHER_TIMEFRAME_MAP.get((interval or "").lower())


def _detect_regime(close_now, ema_fast, ema_slow, slope_close, atr_value):
    if not close_now:
        return {"label": "unknown", "strength": 0}
    atr_pct = (atr_value / close_now) * 100 if atr_value not in (None, 0) else 0
    ema_gap_pct = (abs(ema_fast - ema_slow) / close_now) * 100 if ema_fast is not None and ema_slow is not None else 0
    slope_pct = (abs(slope_close) / close_now) * 100 if slope_close else 0
    if ema_gap_pct >= 0.2 and slope_pct >= 0.01:
        label = "trend"
        strength = 82 if atr_pct >= 0.35 else 74
    elif atr_pct >= 0.6:
        label = "high_volatility"
        strength = 77
    elif ema_gap_pct <= 0.08:
        label = "range"
        strength = 68
    else:
        label = "transition"
        strength = 58
    return {
        "label": label,
        "strength": strength,
        "atr_pct": round(atr_pct, 4),
        "ema_gap_pct": round(ema_gap_pct, 4),
        "slope_pct": round(slope_pct, 4),
    }


def analyze_candles(candles):
    closes = [c["close"] for c in candles]
    ema20 = _ema(closes, 20)
    ema50 = _ema(closes, 50)
    if not ema20 or not ema50:
        raise MarketDataError("Insufficient candles to compute trend indicators")

    ema_fast = ema20[-1]
    ema_slow = ema50[-1]
    close_now = closes[-1]
    slope_close = _series_slope(closes[-30:])
    atr_value = _atr(candles, 14)

    low_pivots = _find_pivots(candles, window=3, kind="low")
    high_pivots = _find_pivots(candles, window=3, kind="high")

    support_line = _linear_regression(low_pivots[-6:]) if len(low_pivots) >= 2 else None
    resistance_line = _linear_regression(high_pivots[-6:]) if len(high_pivots) >= 2 else None

    last_idx = len(candles) - 1
    support_now = _line_value(support_line, last_idx)
    resistance_now = _line_value(resistance_line, last_idx)

    if close_now > ema_fast > ema_slow and slope_close > 0:
        trend = "bullish"
    elif close_now < ema_fast < ema_slow and slope_close < 0:
        trend = "bearish"
    else:
        trend = "sideways"

    if atr_value is None:
        atr_value = abs(close_now) * 0.005

    regime = _detect_regime(
        close_now=close_now,
        ema_fast=ema_fast,
        ema_slow=ema_slow,
        slope_close=slope_close,
        atr_value=atr_value,
    )

    if trend == "bullish":
        entry = close_now
        base_sl = support_now if support_now is not None else close_now - atr_value
        stop_loss = min(base_sl - atr_value * 0.35, close_now - atr_value * 0.8)
        risk = max(entry - stop_loss, atr_value * 0.3)
        target_multipliers = (1.0, 1.85, 2.7, 3.5) if regime["label"] == "trend" else (0.85, 1.5, 2.1, 2.8)
        targets = [entry + risk * m for m in target_multipliers]
    elif trend == "bearish":
        entry = close_now
        base_sl = resistance_now if resistance_now is not None else close_now + atr_value
        stop_loss = max(base_sl + atr_value * 0.35, close_now + atr_value * 0.8)
        risk = max(stop_loss - entry, atr_value * 0.3)
        target_multipliers = (1.0, 1.85, 2.7, 3.5) if regime["label"] == "trend" else (0.85, 1.5, 2.1, 2.8)
        targets = [entry - risk * m for m in target_multipliers]
    else:
        entry = close_now
        stop_loss = close_now - atr_value if slope_close >= 0 else close_now + atr_value
        targets = [None, None, None, None]
        target_multipliers = (0, 0, 0, 0)

    trendlines = []
    if support_line:
        trendlines.append(
            {
                "name": "support",
                "slope": support_line[0],
                "intercept": support_line[1],
                "at_last_candle": _round_price(support_now),
                "anchor_points": [
                    {
                        "index": idx,
                        "time": candles[idx]["time"],
                        "price": _round_price(price),
                    }
                    for idx, price in low_pivots[-6:]
                ],
            }
        )
    if resistance_line:
        trendlines.append(
            {
                "name": "resistance",
                "slope": resistance_line[0],
                "intercept": resistance_line[1],
                "at_last_candle": _round_price(resistance_now),
                "anchor_points": [
                    {
                        "index": idx,
                        "time": candles[idx]["time"],
                        "price": _round_price(price),
                    }
                    for idx, price in high_pivots[-6:]
                ],
            }
        )

    reasoning = _build_reasoning(
        trend=trend,
        close_now=close_now,
        ema_fast=ema_fast,
        ema_slow=ema_slow,
        slope_close=slope_close,
        atr_value=atr_value,
        support_now=support_now,
        resistance_now=resistance_now,
    )

    entry_quality = _entry_quality(
        trend=trend,
        close_now=close_now,
        support_now=support_now,
        resistance_now=resistance_now,
        atr_value=atr_value,
    )

    return {
        "trend": trend,
        "regime": regime,
        "price": _round_price(close_now),
        "entry": _round_price(entry),
        "stop_loss": _round_price(stop_loss),
        "targets": {
            "T1": _round_price(targets[0]) if targets[0] is not None else None,
            "T2": _round_price(targets[1]) if targets[1] is not None else None,
            "T3": _round_price(targets[2]) if targets[2] is not None else None,
            "T4": _round_price(targets[3]) if targets[3] is not None else None,
        },
        "indicators": {
            "ema20": _round_price(ema_fast),
            "ema50": _round_price(ema_slow),
            "atr14": _round_price(atr_value),
            "close_slope_30": round(slope_close, 8),
        },
        "target_profile": {
            "multipliers": list(target_multipliers),
            "trailing_stop_candidate": regime["label"] == "trend",
        },
        "entry_quality": entry_quality,
        "trendlines": trendlines,
        "reasoning": reasoning,
    }


def analyze_market_symbol(symbol, interval="15m", market_range=None, market=None, provider="auto", use_cache=True):
    cache_key = _cache_key(symbol, interval, market_range or "", market or "", provider)
    ttl = _cache_ttl_for_interval(interval)
    now_ts = time.time()
    cached = _ANALYSIS_CACHE.get(cache_key)
    if use_cache and cached:
        age = now_ts - cached.get("created_at", 0)
        if age <= ttl:
            analysis = copy.deepcopy(cached["analysis"])
            analysis["cache_hit"] = True
            analysis["cache_age_seconds"] = int(age)
            analysis["cache_ttl_seconds"] = ttl
            return analysis

    fetch_result = fetch_candles_from_provider(
        symbol=symbol,
        interval=interval,
        market_range=market_range,
        market=market,
        provider=provider,
    )
    candles = fetch_result["candles"]

    live_quote_meta = fetch_live_quote_from_provider(symbol=symbol, market=market, provider=provider)
    if live_quote_meta:
        quote = live_quote_meta.get("quote") or {}
        quote_price = quote.get("price")
        quote_time = quote.get("time")
        if quote_price is not None and candles:
            last = candles[-1]
            last["close"] = float(quote_price)
            last["high"] = max(float(last.get("high", quote_price)), float(quote_price))
            last["low"] = min(float(last.get("low", quote_price)), float(quote_price))
            if quote_time:
                last["time"] = quote_time

    analysis = analyze_candles(candles)
    updated_at = candles[-1]["time"]
    try:
        dt = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
        freshness_seconds = max(0, int((datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds()))
    except Exception:
        freshness_seconds = None

    analysis["symbol"] = symbol
    analysis["interval"] = interval
    analysis["range"] = market_range or INTERVAL_TO_RANGE.get(interval, "5d")
    analysis["updated_at"] = updated_at
    analysis["candles"] = candles[-180:]
    analysis["provider"] = fetch_result.get("provider_used")
    analysis["provider_label"] = fetch_result.get("provider_label")
    analysis["symbol_requested"] = fetch_result.get("symbol_requested")
    analysis["symbol_resolved"] = fetch_result.get("symbol_resolved")
    analysis["provider_notes"] = fetch_result.get("provider_notes")
    analysis["freshness_seconds"] = freshness_seconds
    analysis["provider_attempts"] = fetch_result.get("provider_attempts", [])
    analysis["fallback_used"] = bool(fetch_result.get("fallback_used"))
    analysis["fallback_reason"] = fetch_result.get("fallback_reason")
    analysis["live_quote"] = live_quote_meta.get("quote") if live_quote_meta else None
    analysis["cache_hit"] = False
    analysis["cache_age_seconds"] = 0
    analysis["cache_ttl_seconds"] = ttl

    higher_tf = _higher_timeframe_interval(interval)
    if higher_tf:
        try:
            higher_fetch = fetch_candles_from_provider(
                symbol=symbol,
                interval=higher_tf,
                market_range=INTERVAL_TO_RANGE.get(higher_tf),
                market=market,
                provider=provider,
            )
            higher_analysis = analyze_candles(higher_fetch["candles"])
            analysis["multi_timeframe"] = {
                "higher_interval": higher_tf,
                "higher_trend": higher_analysis.get("trend"),
                "aligned": higher_analysis.get("trend") == analysis.get("trend") and analysis.get("trend") != "sideways",
                "higher_entry_quality": higher_analysis.get("entry_quality"),
            }
        except Exception:
            analysis["multi_timeframe"] = {
                "higher_interval": higher_tf,
                "higher_trend": None,
                "aligned": False,
                "higher_entry_quality": None,
            }
    else:
        analysis["multi_timeframe"] = None

    if use_cache:
        _ANALYSIS_CACHE[cache_key] = {
            "created_at": now_ts,
            "analysis": copy.deepcopy(analysis),
        }
        _trim_cache_if_needed()
    return analysis
