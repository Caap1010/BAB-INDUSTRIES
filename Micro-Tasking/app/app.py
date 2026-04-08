import sys
from pathlib import Path

from flask import Flask


APP_DIR = Path(__file__).resolve().parent
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from config import Config
from routes.dashboard import dashboard_bp
from routes.tasks import tasks_bp
from routes.earnings import earnings_bp
from routes.settings import settings_bp
from utils.db import initialize_database
from utils.task_loader import seed_tasks_if_empty


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    initialize_database(app.config["DATABASE_PATH"])
    seed_tasks_if_empty(app.config["DATABASE_PATH"])

    app.register_blueprint(dashboard_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(earnings_bp)
    app.register_blueprint(settings_bp)

    @app.get("/dashboard")
    def dashboard_redirect():
        return dashboard_bp.view_functions["index"]()

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=5000, debug=True)
