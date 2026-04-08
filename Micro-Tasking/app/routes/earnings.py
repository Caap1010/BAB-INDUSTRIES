from datetime import date

from flask import Blueprint, current_app, redirect, render_template, request, url_for

from utils.db import get_connection
from utils.earnings_calculator import earnings_summary
from utils.paypal_payouts import (
    PayPalConfigurationError,
    PayPalPayoutError,
    fetch_payout_status,
    paypal_connection_status,
    send_payout,
)


earnings_bp = Blueprint("earnings", __name__, url_prefix="/earnings")


@earnings_bp.get("/")
def earnings_page():
    db_path = current_app.config["DATABASE_PATH"]
    default_paypal_email = current_app.config.get("DEFAULT_PAYPAL_EMAIL", "")
    summary = earnings_summary(db_path)
    withdraw_result = request.args.get("withdraw", "").strip()
    process_result = request.args.get("process", "").strip()
    refresh_result = request.args.get("refresh", "").strip()
    paypal_status = paypal_connection_status(current_app.config)
    with get_connection(db_path) as conn:
        entries = conn.execute(
            """
            SELECT *
            FROM earnings
            ORDER BY earned_on DESC, created_at DESC
            LIMIT 200
            """
        ).fetchall()

        withdrawals = conn.execute(
            """
            SELECT *
            FROM withdrawal_requests
            ORDER BY created_at DESC
            LIMIT 100
            """
        ).fetchall()

    return render_template(
        "earnings.html",
        title="Earnings",
        entries=entries,
        summary=summary,
        withdrawals=withdrawals,
        withdraw_result=withdraw_result,
        process_result=process_result,
        refresh_result=refresh_result,
        default_paypal_email=default_paypal_email,
        paypal_status=paypal_status,
    )


@earnings_bp.post("/add")
def add_earning():
    form = request.form
    payload = (
        form.get("platform", "").strip(),
        float(form.get("amount", 0) or 0),
        form.get("status", "Pending").strip(),
        form.get("payout_method", "PayPal").strip(),
        form.get("reference", "").strip(),
        form.get("earned_on", str(date.today())).strip(),
    )

    db_path = current_app.config["DATABASE_PATH"]
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO earnings (platform, amount, status, payout_method, reference, earned_on)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            payload,
        )
        conn.commit()

    return redirect(url_for("earnings.earnings_page"))


@earnings_bp.post("/withdraw/paypal")
def request_paypal_withdrawal():
    form = request.form
    db_path = current_app.config["DATABASE_PATH"]
    summary = earnings_summary(db_path)
    default_paypal_email = current_app.config.get("DEFAULT_PAYPAL_EMAIL", "")

    paypal_email = form.get("paypal_email", "").strip() or default_paypal_email
    note = form.get("note", "").strip()

    try:
        amount = round(float(form.get("amount", 0) or 0), 2)
    except ValueError:
        return redirect(url_for("earnings.earnings_page", withdraw="invalid-amount"))

    if amount <= 0:
        return redirect(url_for("earnings.earnings_page", withdraw="invalid-amount"))
    if "@" not in paypal_email or "." not in paypal_email:
        return redirect(url_for("earnings.earnings_page", withdraw="invalid-email"))
    if amount > summary["available_for_withdrawal"]:
        return redirect(url_for("earnings.earnings_page", withdraw="insufficient"))

    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO withdrawal_requests (amount, provider, paypal_email, status, note, processor_message)
            VALUES (?, 'PayPal', ?, 'Requested', ?, 'Awaiting PayPal processing')
            """,
            (amount, paypal_email, note),
        )
        conn.commit()

    return redirect(url_for("earnings.earnings_page", withdraw="requested"))


@earnings_bp.post("/withdraw/<int:withdrawal_id>/process")
def process_paypal_withdrawal(withdrawal_id):
    db_path = current_app.config["DATABASE_PATH"]

    with get_connection(db_path) as conn:
        withdrawal = conn.execute(
            """
            SELECT *
            FROM withdrawal_requests
            WHERE id = ?
            """,
            (withdrawal_id,),
        ).fetchone()

    if not withdrawal:
        return redirect(url_for("earnings.earnings_page", process="missing"))

    if withdrawal["status"] not in {"Requested", "Failed"}:
        return redirect(url_for("earnings.earnings_page", process="already-processed"))

    try:
        payout = send_payout(
            current_app.config,
            recipient_email=withdrawal["paypal_email"],
            amount=float(withdrawal["amount"]),
            withdrawal_id=withdrawal_id,
            note=withdrawal["note"] or "Micro-Tasking withdrawal",
        )
    except PayPalConfigurationError:
        with get_connection(db_path) as conn:
            conn.execute(
                """
                UPDATE withdrawal_requests
                SET processor_message = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                ("PayPal credentials are not configured.", withdrawal_id),
            )
            conn.commit()
        return redirect(url_for("earnings.earnings_page", process="paypal-not-configured"))
    except PayPalPayoutError as error:
        with get_connection(db_path) as conn:
            conn.execute(
                """
                UPDATE withdrawal_requests
                SET status = 'Failed', processor_message = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (str(error)[:500], withdrawal_id),
            )
            conn.commit()
        return redirect(url_for("earnings.earnings_page", process="failed"))

    with get_connection(db_path) as conn:
        conn.execute(
            """
            UPDATE withdrawal_requests
            SET status = 'Processing',
                external_batch_id = ?,
                external_payout_item_id = ?,
                processor_message = ?,
                processed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (payout.batch_id, payout.payout_item_id, payout.message, withdrawal_id),
        )
        conn.commit()

    return redirect(url_for("earnings.earnings_page", process="submitted"))


@earnings_bp.post("/withdraw/<int:withdrawal_id>/refresh")
def refresh_paypal_withdrawal(withdrawal_id):
    db_path = current_app.config["DATABASE_PATH"]

    with get_connection(db_path) as conn:
        withdrawal = conn.execute(
            """
            SELECT *
            FROM withdrawal_requests
            WHERE id = ?
            """,
            (withdrawal_id,),
        ).fetchone()

    if not withdrawal:
        return redirect(url_for("earnings.earnings_page", refresh="missing"))

    if not withdrawal["external_batch_id"]:
        return redirect(url_for("earnings.earnings_page", refresh="not-submitted"))

    try:
        payout_status = fetch_payout_status(current_app.config, batch_id=withdrawal["external_batch_id"])
    except PayPalConfigurationError:
        return redirect(url_for("earnings.earnings_page", refresh="paypal-not-configured"))
    except PayPalPayoutError as error:
        with get_connection(db_path) as conn:
            conn.execute(
                """
                UPDATE withdrawal_requests
                SET processor_message = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (str(error)[:500], withdrawal_id),
            )
            conn.commit()
        return redirect(url_for("earnings.earnings_page", refresh="failed"))

    batch_status = (payout_status.batch_status or "UNKNOWN").upper()
    item_status = (payout_status.item_status or "").upper()

    app_status = "Processing"
    if item_status in {"SUCCESS", "COMPLETED"}:
        app_status = "Paid"
    elif batch_status in {"DENIED", "FAILED", "CANCELED"} or item_status in {"FAILED", "DENIED", "RETURNED", "BLOCKED"}:
        app_status = "Failed"

    with get_connection(db_path) as conn:
        conn.execute(
            """
            UPDATE withdrawal_requests
            SET status = ?,
                external_payout_item_id = COALESCE(?, external_payout_item_id),
                processor_message = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (app_status, payout_status.payout_item_id, payout_status.message, withdrawal_id),
        )
        conn.commit()

    return redirect(url_for("earnings.earnings_page", refresh="updated"))
