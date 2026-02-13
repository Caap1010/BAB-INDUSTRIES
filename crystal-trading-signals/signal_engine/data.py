import math
import requests
import pandas as pd

BASE_URL = "https://api.twelvedata.com"

# Map our internal intervals to TwelveData
_INTERVAL_MAP = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1h",
    "1d": "1day",
}


def _estimate_outputsize(lookback: str, interval: str) -> int:
    """
    Roughly estimate how many rows to request based on lookback & interval.
    Keeps us well within free tier limits.
    """
    # Convert lookback to minutes
    days = 30
    s = lookback.strip().lower()
    try:
        if s.endswith("d"):
            days = int(s[:-1])
        elif s.endswith("mo"):
            days = int(s[:-2]) * 30
        elif s.endswith("y"):
            days = int(s[:-1]) * 365
    except Exception:
        days = 30

    minutes = days * 24 * 60
    if interval == "1m":
        step = 1
    elif interval == "5m":
        step = 5
    elif interval == "15m":
        step = 15
    elif interval == "30m":
        step = 30
    elif interval in ("60m", "1h"):
        step = 60
    else:
        # daily
        return min(days + 5, 5000)

    return min(math.ceil(minutes / step) + 10, 5000)


def fetch_ohlcv_twelvedata(
    symbol: str, interval: str, lookback: str, api_key: str
) -> pd.DataFrame:
    """
    Fetch OHLCV candles from TwelveData REST API.
    """
    td_interval = _INTERVAL_MAP.get(interval, "15min")
    outputsize = _estimate_outputsize(lookback, interval)

    url = f"{BASE_URL}/time_series"
    params = {
        "symbol": symbol,
        "interval": td_interval,
        "outputsize": outputsize,
        "format": "JSON",
        "apikey": api_key,
        # You can set 'exchange' or 'country' if you need exact venues
    }
    r = requests.get(url, params=params, timeout=15)
    if r.status_code != 200:
        raise ValueError(f"TwelveData HTTP {r.status_code}: {r.text}")

    data = r.json()

    # Handle TwelveData error payloads
    if isinstance(data, dict) and "status" in data and data.get("status") == "error":
        message = data.get("message", "Unknown error")
        raise ValueError(f"TwelveData error for {symbol}: {message}")

    if "values" not in data:
        raise ValueError(f"No 'values' returned for {symbol}: {data}")

    df = pd.DataFrame(data["values"])
    # Expected schema: datetime, open, high, low, close, volume (strings)
    df["datetime"] = pd.to_datetime(df["datetime"], utc=True)
    for col in ("open", "high", "low", "close", "volume"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["open", "high", "low", "close"])
    df = df.sort_values("datetime").set_index("datetime")
    return df


def fetch_ohlcv(
    symbol: str,
    interval: str = "15m",
    lookback: str = "30d",
    tz: str | None = None,
    api_key: str | None = None,
) -> pd.DataFrame:
    """
    Wrapper used by the engine.
    """
    if not api_key:
        raise ValueError("TwelveData API key missing. Set EngineConfig.api_key.")

    df = fetch_ohlcv_twelvedata(symbol, interval, lookback, api_key)

    if tz:
        # TwelveData timestamps are UTC → convert to local
        df.index = df.index.tz_convert(tz)

    # Standardize column names to match the rest of the engine
    df = df.rename(
        columns={
            "open": "open",
            "high": "high",
            "low": "low",
            "close": "close",
            "volume": "volume",
        }
    )
    return df
