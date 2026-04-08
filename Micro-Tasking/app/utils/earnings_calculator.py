from datetime import date, timedelta

from .db import get_connection


def _sum_amount(conn, query, params=()):
    value = conn.execute(query, params).fetchone()["amount"]
    return round(value or 0, 2)


def earnings_summary(db_path):
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    with get_connection(db_path) as conn:
        daily = _sum_amount(
            conn,
            "SELECT SUM(amount) AS amount FROM earnings WHERE earned_on = ?",
            (str(today),),
        )
        weekly = _sum_amount(
            conn,
            "SELECT SUM(amount) AS amount FROM earnings WHERE earned_on >= ?",
            (str(start_of_week),),
        )
        monthly = _sum_amount(
            conn,
            "SELECT SUM(amount) AS amount FROM earnings WHERE earned_on >= ?",
            (str(start_of_month),),
        )
        lifetime = _sum_amount(conn, "SELECT SUM(amount) AS amount FROM earnings")
        pending = _sum_amount(
            conn,
            "SELECT SUM(amount) AS amount FROM earnings WHERE status = 'Pending'",
        )
        withdrawn = _sum_amount(
            conn,
            "SELECT SUM(amount) AS amount FROM earnings WHERE status = 'Withdrawn'",
        )
        paid = _sum_amount(
            conn,
            "SELECT SUM(amount) AS amount FROM earnings WHERE status IN ('Paid', 'Withdrawn')",
        )

        requested_withdrawals = _sum_amount(
            conn,
            """
            SELECT SUM(amount) AS amount
            FROM withdrawal_requests
            WHERE status IN ('Requested', 'Processing', 'Paid')
            """,
        )

        available_for_withdrawal = round(max(paid - requested_withdrawals, 0), 2)

        platform_rows = conn.execute(
            """
            SELECT platform, ROUND(SUM(amount), 2) AS amount
            FROM earnings
            GROUP BY platform
            ORDER BY amount DESC
            """
        ).fetchall()

    return {
        "daily": daily,
        "weekly": weekly,
        "monthly": monthly,
        "lifetime": lifetime,
        "pending": pending,
        "withdrawn": withdrawn,
        "paid": paid,
        "requested_withdrawals": requested_withdrawals,
        "available_for_withdrawal": available_for_withdrawal,
        "platform_breakdown": [dict(row) for row in platform_rows],
    }
