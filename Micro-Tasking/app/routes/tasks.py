from flask import Blueprint, current_app, redirect, render_template, request, url_for

from utils.db import get_connection
from utils.task_loader import load_real_opportunity_tasks


tasks_bp = Blueprint("tasks", __name__, url_prefix="/tasks")


@tasks_bp.get("/")
def task_list():
    status_filter = request.args.get("status", "all").strip()
    seeded_count = request.args.get("seeded", "").strip()
    db_path = current_app.config["DATABASE_PATH"]

    query = "SELECT * FROM tasks"
    params = ()
    if status_filter in {"Pending", "In Progress", "Done"}:
        query += " WHERE status = ?"
        params = (status_filter,)

    query += " ORDER BY created_at DESC"

    with get_connection(db_path) as conn:
        tasks = conn.execute(query, params).fetchall()

    return render_template(
        "tasks.html",
        title="Tasks",
        tasks=tasks,
        status_filter=status_filter,
        seeded_count=seeded_count,
    )


@tasks_bp.post("/load-real")
def load_real_tasks():
    db_path = current_app.config["DATABASE_PATH"]
    inserted = load_real_opportunity_tasks(db_path)
    return redirect(url_for("tasks.task_list", seeded=inserted))


@tasks_bp.post("/add")
def add_task():
    form = request.form
    payload = (
        form.get("title", "").strip(),
        form.get("platform", "").strip(),
        form.get("category", "").strip(),
        form.get("priority", "Medium").strip(),
        int(form.get("estimated_time_minutes", 30) or 30),
        float(form.get("estimated_pay", 0) or 0),
        form.get("task_url", "").strip(),
        form.get("status", "Pending").strip(),
        form.get("due_date", "").strip() or None,
        form.get("notes", "").strip(),
    )

    db_path = current_app.config["DATABASE_PATH"]
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO tasks (
                title, platform, category, priority, estimated_time_minutes,
                estimated_pay, task_url, status, due_date, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            payload,
        )
        conn.commit()

    return redirect(url_for("tasks.task_list"))


@tasks_bp.post("/<int:task_id>/status")
def update_status(task_id):
    new_status = request.form.get("status", "Pending")
    if new_status not in {"Pending", "In Progress", "Done"}:
        new_status = "Pending"
    db_path = current_app.config["DATABASE_PATH"]

    with get_connection(db_path) as conn:
        conn.execute(
            """
            UPDATE tasks
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (new_status, task_id),
        )
        conn.commit()

    next_url = request.form.get("next", "").strip()
    if next_url and next_url.startswith("/"):
        return redirect(next_url)

    return redirect(url_for("tasks.task_list"))
