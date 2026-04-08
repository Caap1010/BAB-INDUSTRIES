from datetime import date, timedelta

from .db import get_connection


REAL_TASK_OPPORTUNITIES = [
    {
        "title": "Apply for available Prolific studies",
        "platform": "Prolific",
        "category": "Research",
        "priority": "High",
        "estimated_time_minutes": 25,
        "estimated_pay": 4.50,
        "task_url": "https://app.prolific.com/studies",
        "status": "Pending",
        "due_date": str(date.today()),
        "notes": "Filter for highest hourly rates and complete qualification checks.",
    },
    {
        "title": "Complete Clickworker UHRS qualification set",
        "platform": "Clickworker",
        "category": "Qualification",
        "priority": "High",
        "estimated_time_minutes": 35,
        "estimated_pay": 5.00,
        "task_url": "https://workplace.clickworker.com",
        "status": "Pending",
        "due_date": str(date.today()),
        "notes": "Improves access to recurring paid annotation jobs.",
    },
    {
        "title": "Submit TranscribeMe entrance transcription",
        "platform": "TranscribeMe",
        "category": "Transcription",
        "priority": "High",
        "estimated_time_minutes": 40,
        "estimated_pay": 6.00,
        "task_url": "https://www.transcribeme.com/jobs",
        "status": "Pending",
        "due_date": str(date.today() + timedelta(days=1)),
        "notes": "Use clear audio settings and follow style guide strictly.",
    },
    {
        "title": "Pick and finish a Toloka image relevance batch",
        "platform": "Toloka",
        "category": "Data Labeling",
        "priority": "Medium",
        "estimated_time_minutes": 30,
        "estimated_pay": 3.40,
        "task_url": "https://toloka.ai/tolokers/tasks",
        "status": "Pending",
        "due_date": str(date.today() + timedelta(days=1)),
        "notes": "Prioritize tasks with stable acceptance history.",
    },
    {
        "title": "Review Appen project invites and apply",
        "platform": "Appen",
        "category": "Project Application",
        "priority": "Medium",
        "estimated_time_minutes": 30,
        "estimated_pay": 8.00,
        "task_url": "https://contributor.appen.com",
        "status": "Pending",
        "due_date": str(date.today() + timedelta(days=2)),
        "notes": "Focus on language and search relevance projects.",
    },
    {
        "title": "Check Remotasks queue for LiDAR/image tasks",
        "platform": "Remotasks",
        "category": "Annotation",
        "priority": "Medium",
        "estimated_time_minutes": 35,
        "estimated_pay": 4.20,
        "task_url": "https://www.remotasks.com/dashboard",
        "status": "Pending",
        "due_date": str(date.today() + timedelta(days=1)),
        "notes": "Complete tasks with clear instructions and low dispute rates.",
    },
]


DEFAULT_TASKS = REAL_TASK_OPPORTUNITIES[:3]


def seed_tasks_if_empty(db_path):
    with get_connection(db_path) as conn:
        count = conn.execute("SELECT COUNT(*) AS count FROM tasks").fetchone()["count"]
        if count:
            return

        conn.executemany(
            """
            INSERT INTO tasks (
                title, platform, category, priority, estimated_time_minutes,
                estimated_pay, task_url, status, due_date, notes
            ) VALUES (
                :title, :platform, :category, :priority, :estimated_time_minutes,
                :estimated_pay, :task_url, :status, :due_date, :notes
            )
            """,
            DEFAULT_TASKS,
        )
        conn.commit()


def load_real_opportunity_tasks(db_path):
    inserted = 0
    with get_connection(db_path) as conn:
        for task in REAL_TASK_OPPORTUNITIES:
            exists = conn.execute(
                """
                SELECT 1
                FROM tasks
                WHERE title = ? AND platform = ?
                LIMIT 1
                """,
                (task["title"], task["platform"]),
            ).fetchone()
            if exists:
                continue

            conn.execute(
                """
                INSERT INTO tasks (
                    title, platform, category, priority, estimated_time_minutes,
                    estimated_pay, task_url, status, due_date, notes
                ) VALUES (
                    :title, :platform, :category, :priority, :estimated_time_minutes,
                    :estimated_pay, :task_url, :status, :due_date, :notes
                )
                """,
                task,
            )
            inserted += 1

        conn.commit()

    return inserted
