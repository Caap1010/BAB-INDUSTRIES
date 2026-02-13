from typing import List, Dict
from pathlib import Path

from .config import IndicatorConfig, RiskConfig, EngineConfig
from .data import fetch_ohlcv
from .strategy import generate_signal
from .utils import to_json, to_csv, ensure_dir

# Keep universe small first; we can expand once you confirm output.
DEFAULT_UNIVERSE: Dict[str, List[str]] = {
    "stocks": ["AAPL", "MSFT"],
    "forex": ["EUR/USD", "USD/ZAR"],
    "crypto": ["BTC/USD", "ETH/USD"],
    # Indices & commodities require correct symbols on TwelveData; we’ll map later.
}


class SignalEngine:
    def __init__(
        self,
        icfg: IndicatorConfig = IndicatorConfig(),
        rcfg: RiskConfig = RiskConfig(),
        ecfg: EngineConfig = EngineConfig(),
    ):
        self.icfg = icfg
        self.rcfg = rcfg
        self.ecfg = ecfg
        ensure_dir(self.ecfg.out_dir)

    def run(self, tickers: List[str]):
        signals = []
        for sym in tickers:
            try:
                df = fetch_ohlcv(
                    sym,
                    interval=self.ecfg.interval,
                    lookback=self.ecfg.lookback,
                    tz=self.ecfg.timezone,
                    api_key=self.ecfg.api_key,  # <-- pass key to data layer
                )
                sig = generate_signal(sym, self.ecfg.interval, df, self.icfg, self.rcfg)
                signals.append(sig)
                print(
                    f"[OK] {sym:>10s} @ {self.ecfg.interval} → {sig.signal} | entry={sig.entry} | SL={sig.sl} | TP1={sig.tp1} | TP2={sig.tp2} | {sig.reason}"
                )
            except Exception as e:
                print(f"[ERR] {sym}: {e}")

        if self.ecfg.write_outputs and signals:
            base = Path(self.ecfg.out_dir)
            to_json(signals, (base / f"signals_{self.ecfg.interval}.json").as_posix())
            to_csv(signals, (base / f"signals_{self.ecfg.interval}.csv").as_posix())
        return signals

    @staticmethod
    def flatten_universe(u: Dict[str, List[str]]) -> List[str]:
        arr = []
        for _, v in u.items():
            arr.extend(v)
        return arr
