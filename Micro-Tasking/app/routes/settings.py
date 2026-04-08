from flask import Blueprint, current_app, render_template

from utils.db import get_connection
from utils.paypal_payouts import paypal_connection_status


settings_bp = Blueprint("settings", __name__, url_prefix="/settings")


@settings_bp.get("/")
def settings_page():
    db_path = current_app.config["DATABASE_PATH"]
    default_paypal_email = current_app.config.get("DEFAULT_PAYPAL_EMAIL", "")
    paypal_status = paypal_connection_status(current_app.config)
    with get_connection(db_path) as conn:
        totals = {
            "task_count": conn.execute("SELECT COUNT(*) AS count FROM tasks").fetchone()["count"],
            "earning_count": conn.execute("SELECT COUNT(*) AS count FROM earnings").fetchone()["count"],
            "session_count": conn.execute("SELECT COUNT(*) AS count FROM productivity_sessions").fetchone()["count"],
        }

    platforms = [
        "Clickworker",
        "Remotasks",
        "UHRS",
        "Appen",
        "Prolific",
        "Amazon MTurk",
        "Toloka",
        "Lionbridge AI",
    ]

    return render_template(
        "settings.html",
        title="Settings",
        totals=totals,
        platforms=platforms,
        default_paypal_email=default_paypal_email,
        paypal_status=paypal_status,
    )
