import json
from pathlib import Path
from typing import List
import pandas as pd
from .strategy import Signal


def ensure_dir(path: str):
    Path(path).mkdir(parents=True, exist_ok=True)


def to_json(signals: List[Signal], path: str):
    ensure_dir(Path(path).parent.as_posix())
    payload = [s.__dict__ for s in signals]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def to_csv(signals: List[Signal], path: str):
    ensure_dir(Path(path).parent.as_posix())
    df = pd.DataFrame([s.__dict__ for s in signals])
    df.to_csv(path, index=False)
