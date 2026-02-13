from signal_engine.engine import SignalEngine, DEFAULT_UNIVERSE
from signal_engine.config import EngineConfig, IndicatorConfig, RiskConfig

if __name__ == "__main__":
    # 🔐 Paste your TwelveData key here (keep it private!)
    TD_API_KEY = "PASTE_YOUR_TWELVEDATA_KEY_HERE"

    ecfg = EngineConfig(
        interval="15m",  # '1m','5m','15m','30m','1h','1d'
        lookback="30d",
        timezone="Africa/Johannesburg",
        write_outputs=True,
        out_dir="out",
        api_key=TD_API_KEY,  # <-- pass key into engine config
    )
    icfg = IndicatorConfig(
        rsi_period=14,
        ema_fast=12,
        ema_slow=26,
        macd_signal=9,
        atr_period=14,
        ma_trend=20,
        supertrend_multiplier=3.0,
        supertrend_period=10,
    )
    rcfg = RiskConfig(
        atr_sl_mult=1.5,
        atr_tp1_mult=2.0,
        atr_tp2_mult=3.0,
        risk_per_trade_pct=1.0,
    )

    engine = SignalEngine(icfg=icfg, rcfg=rcfg, ecfg=ecfg)

    # Start small (confirmed-good TwelveData symbols)
    tickers = SignalEngine.flatten_universe(DEFAULT_UNIVERSE)

    engine.run(tickers)
