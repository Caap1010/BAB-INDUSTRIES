import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATABASE_DIR = BASE_DIR / "database"
DATABASE_PATH = DATABASE_DIR / "tasks.db"


class Config:
    SECRET_KEY = "micro-tasking-local-dev-key"
    DATABASE_PATH = DATABASE_PATH
    DEFAULT_PAYPAL_EMAIL = "sfisotshotwane@gmail.com"
    PAYPAL_ENVIRONMENT = os.getenv("MICRO_TASKING_PAYPAL_ENVIRONMENT", "sandbox").strip().lower() or "sandbox"
    PAYPAL_CLIENT_ID = os.getenv("MICRO_TASKING_PAYPAL_CLIENT_ID", "").strip()
    PAYPAL_CLIENT_SECRET = os.getenv("MICRO_TASKING_PAYPAL_CLIENT_SECRET", "").strip()
    PAYPAL_WEB_BASE_URL = "https://www.sandbox.paypal.com" if PAYPAL_ENVIRONMENT == "sandbox" else "https://www.paypal.com"
    PAYPAL_API_BASE_URL = (
        "https://api-m.sandbox.paypal.com"
        if PAYPAL_ENVIRONMENT == "sandbox"
        else "https://api-m.paypal.com"
    )
    JSON_SORT_KEYS = False
