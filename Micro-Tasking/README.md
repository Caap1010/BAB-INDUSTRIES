# Micro-Tasking Dashboard

Personal localhost dashboard for organizing and tracking legitimate micro-task work.

## Features

- Daily task planning by platform, priority, and estimated pay
- Earnings tracking (daily, weekly, monthly, lifetime)
- Productivity helpers (next best task, task agent planning brief, focus session logging)
- PayPal withdrawal requests with official PayPal Payouts integration path
- SQLite local storage
- BAB-Industries-HQ inspired dark theme

## Run locally

1. Create and activate a Python environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Start the app:
   - `python app/app.py`
4. Open:
   - `http://127.0.0.1:5000`

## Real PayPal Setup

Set these environment variables before starting the app:

- `MICRO_TASKING_PAYPAL_CLIENT_ID`
- `MICRO_TASKING_PAYPAL_CLIENT_SECRET`
- `MICRO_TASKING_PAYPAL_ENVIRONMENT=sandbox` or `live`

Without those credentials, withdrawal requests are stored locally but cannot be submitted to PayPal.

### Windows PowerShell Example

```powershell
$env:MICRO_TASKING_PAYPAL_ENVIRONMENT = "sandbox"
$env:MICRO_TASKING_PAYPAL_CLIENT_ID = "your-paypal-client-id"
$env:MICRO_TASKING_PAYPAL_CLIENT_SECRET = "your-paypal-client-secret"
python app/app.py
```

You can also use [run-paypal-sandbox.ps1](run-paypal-sandbox.ps1) after setting the credential variables in your shell.

### Payout Reconciliation

- `Send To PayPal` submits a requested withdrawal to the PayPal Payouts API.
- `Refresh Status` checks the PayPal batch and updates the local withdrawal to `Processing`, `Paid`, or `Failed`.

## Structure

- `app/routes`: page and action routes
- `app/utils`: database and business helpers
- `app/templates`: HTML templates
- `app/static`: CSS, JS, images
- `app/database/tasks.db`: local SQLite database (auto-created)
