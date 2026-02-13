from dataclasses import dataclass
from typing import Dict, Any
import pandas as pd

from .indicators import sma, ema, rsi_wilder, macd, atr, supertrend
from .config import IndicatorConfig, RiskConfig


@dataclass
class Signal:
    symbol: str
    timeframe: str
    timestamp: str
    signal: str  # BUY/SELL/HOLD
    entry: float
    sl: float
    tp1: float
    tp2: float
    rr_tp1: float
    rr_tp2: float
    reason: str


def compute_indicators(df: pd.DataFrame, icfg: IndicatorConfig) -> pd.DataFrame:
    df = df.copy()
    df["ma_trend"] = ema(df["close"], icfg.ma_trend)
    df["rsi"] = rsi_wilder(df["close"], icfg.rsi_period)
    macd_line, signal_line, hist = macd(
        df["close"], icfg.ema_fast, icfg.ema_slow, icfg.macd_signal
    )
    df["macd"] = macd_line
    df["macd_signal"] = signal_line
    df["macd_hist"] = hist
    df["atr"] = atr(df["high"], df["low"], df["close"], icfg.atr_period)
    st = supertrend(df, icfg.supertrend_period, icfg.supertrend_multiplier)
    df = df.join(st)
    return df.dropna()


def _crosses_above(s: pd.Series, ref: pd.Series) -> pd.Series:
    return (s > ref) & (s.shift(1) <= ref.shift(1))


def _crosses_below(s: pd.Series, ref: pd.Series) -> pd.Series:
    return (s < ref) & (s.shift(1) >= ref.shift(1))


def generate_signal_row(df: pd.DataFrame, rcfg: RiskConfig) -> Dict[str, Any]:
    """
    Generates a signal based on the last completed candle.
    """
    last = df.iloc[-1]
    prev = df.iloc[-2]

    # Conditions
    bull_cross = (last["close"] > last["ma_trend"]) and (
        prev["close"] <= prev["ma_trend"]
    )
    bear_cross = (last["close"] < last["ma_trend"]) and (
        prev["close"] >= prev["ma_trend"]
    )

    macd_bull = (last["macd_hist"] > 0) and (last["macd_hist"] > prev["macd_hist"])
    macd_bear = (last["macd_hist"] < 0) and (last["macd_hist"] < prev["macd_hist"])

    rsi_bull = last["rsi"] > 50
    rsi_bear = last["rsi"] < 50

    st_up = last["st_dir"] == 1
    st_dn = last["st_dir"] == -1

    entry = float(last["close"])
    atr_val = float(last["atr"])

    # Long setup
    if bull_cross and macd_bull and rsi_bull and st_up:
        sl = min(float(last["st"]), entry - rcfg.atr_sl_mult * atr_val)
        tp1 = entry + rcfg.atr_tp1_mult * atr_val
        tp2 = entry + rcfg.atr_tp2_mult * atr_val
        risk = max(entry - sl, 1e-8)
        rr1 = (tp1 - entry) / risk
        rr2 = (tp2 - entry) / risk
        return {
            "side": "BUY",
            "entry": round(entry, 6),
            "sl": round(sl, 6),
            "tp1": round(tp1, 6),
            "tp2": round(tp2, 6),
            "rr_tp1": round(rr1, 2),
            "rr_tp2": round(rr2, 2),
            "reason": "MA20 cross↑ & MACD↑ & RSI>50 & SuperTrend up",
        }

    # Short setup
    if bear_cross and macd_bear and rsi_bear and st_dn:
        sl = max(float(last["st"]), entry + rcfg.atr_sl_mult * atr_val)
        tp1 = entry - rcfg.atr_tp1_mult * atr_val
        tp2 = entry - rcfg.atr_tp2_mult * atr_val
        risk = max(sl - entry, 1e-8)
        rr1 = (entry - tp1) / risk
        rr2 = (entry - tp2) / risk
        return {
            "side": "SELL",
            "entry": round(entry, 6),
            "sl": round(sl, 6),
            "tp1": round(tp1, 6),
            "tp2": round(tp2, 6),
            "rr_tp1": round(rr1, 2),
            "rr_tp2": round(rr2, 2),
            "reason": "MA20 cross↓ & MACD↓ & RSI<50 & SuperTrend down",
        }

    # Exit suggestions (state-less)
    exit_reason = None
    if last["rsi"] >= 70:
        exit_reason = "RSI≥70 — take profits on longs"
    elif last["rsi"] <= 30:
        exit_reason = "RSI≤30 — take profits on shorts"
    elif last["macd_hist"] * prev["macd_hist"] < 0:
        exit_reason = "MACD momentum flip"

    return {
        "side": "HOLD" if exit_reason is None else "EXIT",
        "entry": round(entry, 6),
        "sl": None,
        "tp1": None,
        "tp2": None,
        "rr_tp1": None,
        "rr_tp2": None,
        "reason": "No aligned setup" if exit_reason is None else exit_reason,
    }


def generate_signal(
    symbol: str,
    timeframe: str,
    df: pd.DataFrame,
    icfg: IndicatorConfig,
    rcfg: RiskConfig,
) -> Signal:
    indf = compute_indicators(df, icfg)
    row = generate_signal_row(indf, rcfg)
    ts = indf.index[-1].isoformat()
    return Signal(
        symbol=symbol,
        timeframe=timeframe,
        timestamp=ts,
        signal=row["side"],
        entry=row["entry"],
        sl=row["sl"],
        tp1=row["tp1"],
        tp2=row["tp2"],
        rr_tp1=row["rr_tp1"],
        rr_tp2=row["rr_tp2"],
        reason=row["reason"],
    )
