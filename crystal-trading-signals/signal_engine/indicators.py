import numpy as np
import pandas as pd


def sma(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(length, min_periods=length).mean()


def ema(series: pd.Series, length: int) -> pd.Series:
    return series.ewm(span=length, adjust=False).mean()


def rsi_wilder(close: pd.Series, length: int = 14) -> pd.Series:
    delta = close.diff()
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    gain_ewm = (
        pd.Series(gain, index=close.index).ewm(alpha=1 / length, adjust=False).mean()
    )
    loss_ewm = (
        pd.Series(loss, index=close.index).ewm(alpha=1 / length, adjust=False).mean()
    )
    rs = gain_ewm / (loss_ewm + 1e-12)
    rsi = 100 - (100 / (1 + rs))
    return rsi


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    macd_line = ema(close, fast) - ema(close, slow)
    signal_line = ema(macd_line, signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


def true_range(high: pd.Series, low: pd.Series, close: pd.Series) -> pd.Series:
    prev_close = close.shift(1)
    tr = np.maximum(
        high - low, np.maximum((high - prev_close).abs(), (low - prev_close).abs())
    )
    return tr


def atr(
    high: pd.Series, low: pd.Series, close: pd.Series, length: int = 14
) -> pd.Series:
    tr = true_range(high, low, close)
    return tr.ewm(alpha=1 / length, adjust=False).mean()


def supertrend(
    df: pd.DataFrame, period: int = 10, multiplier: float = 3.0
) -> pd.DataFrame:
    """
    Returns df with columns: 'st', 'st_dir', 'st_upper', 'st_lower'
    st_dir: +1 uptrend, -1 downtrend
    """
    hl2 = (df["high"] + df["low"]) / 2.0
    _atr = atr(df["high"], df["low"], df["close"], length=period)

    upperband = hl2 + (multiplier * _atr)
    lowerband = hl2 - (multiplier * _atr)

    st = pd.Series(index=df.index, dtype=float)
    st_dir = pd.Series(index=df.index, dtype=int)

    for i in range(len(df)):
        if i == 0:
            st.iloc[i] = upperband.iloc[i]
            st_dir.iloc[i] = 1
        else:
            prev = i - 1
            # Compute provisional bands
            curr_upper = upperband.iloc[i]
            curr_lower = lowerband.iloc[i]
            prev_st = st.iloc[prev]
            prev_dir = st_dir.iloc[prev]
            close_i = df["close"].iloc[i]

            # Refine bands to avoid flips due to noise
            if curr_upper < prev_st or prev_dir == -1:
                upper = curr_upper
            else:
                upper = prev_st
            if curr_lower > prev_st or prev_dir == 1:
                lower = curr_lower
            else:
                lower = prev_st

            # Direction and ST line
            if close_i > upper:
                st_dir.iloc[i] = 1
                st.iloc[i] = lower
            elif close_i < lower:
                st_dir.iloc[i] = -1
                st.iloc[i] = upper
            else:
                st_dir.iloc[i] = prev_dir
                st.iloc[i] = lower if prev_dir == 1 else upper

    out = pd.DataFrame(
        {"st": st, "st_dir": st_dir, "st_upper": upperband, "st_lower": lowerband},
        index=df.index,
    )
    return out
