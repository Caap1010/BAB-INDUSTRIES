from dataclasses import dataclass


@dataclass
class IndicatorConfig:
    rsi_period: int = 14
    ema_fast: int = 12
    ema_slow: int = 26
    macd_signal: int = 9
    atr_period: int = 14
    ma_trend: int = 20
    supertrend_multiplier: float = 3.0
    supertrend_period: int = 10


@dataclass
class RiskConfig:
    atr_sl_mult: float = 1.5
    atr_tp1_mult: float = 2.0
    atr_tp2_mult: float = 3.0
    risk_per_trade_pct: float = 1.0


@dataclass
class EngineConfig:
    interval: str = "15m"  # '1m','5m','15m','30m','1h','1d'
    lookback: str = "30d"
    timezone: str = "Africa/Johannesburg"
    write_outputs: bool = True
    out_dir: str = "out"
    api_key: str | None = None  # <-- NEW: TwelveData API key
