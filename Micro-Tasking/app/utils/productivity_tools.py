from datetime import date

from .db import get_connection
from .earnings_calculator import earnings_summary


def next_best_task(db_path):
    with get_connection(db_path) as conn:
        row = conn.execute(
            """
            SELECT *
            FROM tasks
            WHERE status IN ('Pending', 'In Progress')
            ORDER BY
                CASE priority
                    WHEN 'High' THEN 1
                    WHEN 'Medium' THEN 2
                    ELSE 3
                END,
                estimated_pay DESC,
                estimated_time_minutes ASC
            LIMIT 1
            """
        ).fetchone()

    return dict(row) if row else None


def start_pomodoro_session(db_path, minutes=25):
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO productivity_sessions (session_type, duration_minutes, completed)
            VALUES (?, ?, 0)
            """,
            ("pomodoro", int(minutes)),
        )
        conn.commit()


def build_daily_plan(db_path):
    today = str(date.today())
    with get_connection(db_path) as conn:
        rows = conn.execute(
            """
            SELECT id, title, platform, priority, estimated_time_minutes, estimated_pay, due_date, status
            FROM tasks
            WHERE status IN ('Pending', 'In Progress')
            ORDER BY
                CASE
                    WHEN due_date IS NOT NULL AND due_date < ? THEN 0
                    WHEN due_date = ? THEN 1
                    ELSE 2
                END,
                CASE priority
                    WHEN 'High' THEN 1
                    WHEN 'Medium' THEN 2
                    ELSE 3
                END,
                estimated_pay DESC,
                estimated_time_minutes ASC
            LIMIT 12
            """,
            (today, today),
        ).fetchall()

    blocks = [
        {"name": "Morning Sprint", "tasks": [], "total_minutes": 0, "total_pay": 0.0},
        {"name": "Afternoon Push", "tasks": [], "total_minutes": 0, "total_pay": 0.0},
        {"name": "Evening Wrap", "tasks": [], "total_minutes": 0, "total_pay": 0.0},
    ]

    for row in rows:
        task = dict(row)
        if (
            (task.get("priority") == "High" or task.get("due_date") == today)
            and len(blocks[0]["tasks"]) < 5
        ):
            index = 0
        else:
            index = min(
                range(len(blocks)),
                key=lambda i: (blocks[i]["total_minutes"], len(blocks[i]["tasks"])),
            )

        block = blocks[index]
        block["tasks"].append(task)
        block["total_minutes"] += int(task.get("estimated_time_minutes") or 0)
        block["total_pay"] += float(task.get("estimated_pay") or 0)

    for block in blocks:
        block["total_pay"] = round(block["total_pay"], 2)

    return blocks


def build_task_agent_brief(db_path):
    suggested_task = next_best_task(db_path)
    summary = earnings_summary(db_path)
    today = str(date.today())

    with get_connection(db_path) as conn:
        counts = conn.execute(
            """
            SELECT
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
                SUM(CASE WHEN priority = 'High' AND status IN ('Pending', 'In Progress') THEN 1 ELSE 0 END) AS high_priority_count,
                SUM(CASE WHEN due_date = ? AND status IN ('Pending', 'In Progress') THEN 1 ELSE 0 END) AS due_today_count,
                SUM(CASE WHEN due_date < ? AND status != 'Done' THEN 1 ELSE 0 END) AS overdue_count
            FROM tasks
            """,
            (today, today),
        ).fetchone()

        platform_focus = conn.execute(
            """
            SELECT platform, COUNT(*) AS task_count, ROUND(SUM(estimated_pay), 2) AS total_pay
            FROM tasks
            WHERE status IN ('Pending', 'In Progress')
            GROUP BY platform
            ORDER BY total_pay DESC, task_count DESC, platform ASC
            LIMIT 1
            """
        ).fetchone()

        session_count = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM productivity_sessions
            """
        ).fetchone()["count"]

    pending_count = counts["pending_count"] or 0
    in_progress_count = counts["in_progress_count"] or 0
    high_priority_count = counts["high_priority_count"] or 0
    due_today_count = counts["due_today_count"] or 0
    overdue_count = counts["overdue_count"] or 0

    if suggested_task:
        focus_minutes = max(15, min(int(suggested_task["estimated_time_minutes"] or 25), 50))
        headline = f"Start with {suggested_task['title']} on {suggested_task['platform']}."
    elif pending_count:
        focus_minutes = 25
        headline = "Clear one pending task before adding new work."
    else:
        focus_minutes = 20
        headline = "Your queue is clear. Capture the next legitimate task before momentum drops."

    summary_bits = []
    if overdue_count:
        summary_bits.append(f"{overdue_count} overdue")
    if due_today_count:
        summary_bits.append(f"{due_today_count} due today")
    if high_priority_count:
        summary_bits.append(f"{high_priority_count} high priority")
    if in_progress_count:
        summary_bits.append(f"{in_progress_count} already in progress")
    if summary["pending"]:
        summary_bits.append(f"${summary['pending']:.2f} pending payout")

    focus_summary = ", ".join(summary_bits) if summary_bits else "No urgent pressure in the queue right now."
    action_limit = max(3, min(pending_count, 5))
    actions = [
        f"Work the best available task for {focus_minutes} minutes before switching tabs.",
        f"Keep the active queue under {action_limit} open items to avoid task drift.",
        f"Review earnings after the session. Weekly total: ${summary['weekly']:.2f}.",
    ]

    if platform_focus:
        platform_name = platform_focus["platform"]
        platform_pay = platform_focus["total_pay"] or 0
    else:
        platform_name = "No platform selected"
        platform_pay = 0

    return {
        "headline": headline,
        "focus_summary": focus_summary,
        "actions": actions,
        "suggested_task": suggested_task,
        "focus_minutes": focus_minutes,
        "platform_name": platform_name,
        "platform_pay": platform_pay,
        "session_count": session_count,
    }
