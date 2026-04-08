from flask import Blueprint, current_app, redirect, render_template, request, url_for

from utils.db import get_connection
from utils.earnings_calculator import earnings_summary
from utils.productivity_tools import (
    build_daily_plan,
    build_task_agent_brief,
    next_best_task,
    start_pomodoro_session,
)


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/")
def index():
    db_path = current_app.config["DATABASE_PATH"]
    focus_started = request.args.get("focus") == "started"
    auto_finished = request.args.get("finished") == "1"
    with get_connection(db_path) as conn:
        task_counts = {
            "pending": conn.execute("SELECT COUNT(*) AS count FROM tasks WHERE status = 'Pending'").fetchone()["count"],
            "in_progress": conn.execute("SELECT COUNT(*) AS count FROM tasks WHERE status = 'In Progress'").fetchone()["count"],
            "done": conn.execute("SELECT COUNT(*) AS count FROM tasks WHERE status = 'Done'").fetchone()["count"],
        }
        today_tasks = conn.execute(
            """
            SELECT * FROM tasks
            WHERE status IN ('Pending', 'In Progress')
            ORDER BY
                CASE priority
                    WHEN 'High' THEN 1
                    WHEN 'Medium' THEN 2
                    ELSE 3
                END,
                estimated_pay DESC
            LIMIT 8
            """
        ).fetchall()

    return render_template(
        "index.html",
        title="Daily Dashboard",
        task_counts=task_counts,
        today_tasks=today_tasks,
        earnings=earnings_summary(db_path),
        suggested_task=next_best_task(db_path),
        task_agent=build_task_agent_brief(db_path),
        daily_plan=build_daily_plan(db_path),
        focus_started=focus_started,
        auto_finished=auto_finished,
    )


@dashboard_bp.post("/assistant/focus-session")
def start_focus_session():
    db_path = current_app.config["DATABASE_PATH"]
    requested_minutes = request.form.get("minutes", "25").strip()

    try:
        minutes = max(15, min(int(requested_minutes), 60))
    except ValueError:
        minutes = 25

    start_pomodoro_session(db_path, minutes=minutes)
    return redirect(url_for("dashboard.index", focus="started"))


@dashboard_bp.post("/assistant/auto-finish")
def auto_finish_task():
    task_id = request.form.get("task_id", "").strip()
    if not task_id.isdigit():
        return redirect(url_for("dashboard.index"))

    db_path = current_app.config["DATABASE_PATH"]
    with get_connection(db_path) as conn:
        conn.execute(
            """
            UPDATE tasks
            SET status = 'Done', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status IN ('Pending', 'In Progress')
            """,
            (int(task_id),),
        )
        conn.commit()

    return redirect(url_for("dashboard.index", finished="1"))
