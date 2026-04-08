# BAB-INDUSTRIES

Company HQ

## Live Market Analyzer System

This workspace now includes a live, multi-market technical analysis system built into Django.

### What it does

- Pulls live market candles from Yahoo Finance chart API for:
  - indices
  - stocks
  - futures
  - forex
  - crypto
- Detects trend direction (`bullish`, `bearish`, `sideways`) using EMA structure and momentum slope.
- Builds support/resistance trendlines from pivot highs/lows.
- Generates trade levels:
  - `entry`
  - `stop_loss` (SL)
  - `T1`, `T2`, `T3`, `T4`
- Returns reasoning bullets explaining why the model classified the market direction.

### New routes

- Dashboard UI: `/market-analyzer/`
- Symbol universe: `/api/market/symbols/`
- Provider list: `/api/market/providers/`
- Single analysis: `/api/market/analyze/?market=crypto&symbol=BTC-USD&interval=15m`
- All-markets scan: `/api/market/analyze-all/?interval=15m`

### WebSocket live stream

- Endpoint: `/ws/market/stream/`
- Query options:
  - `market`, `symbol`, `interval`, `range`, `provider`, `refresh`
- Example:
  - `ws://localhost:8000/ws/market/stream/?market=crypto&symbol=BTC-USD&interval=15m&provider=binance&refresh=6`

### Provider adapters

- `auto`: Automatically chooses provider by market (crypto -> Binance, others -> Yahoo).
- `yahoo`: Broad multi-asset adapter.
- `binance`: Crypto adapter (spot klines).
- `alpha_vantage`: Extension point (API key required).
- `polygon`: Extension point (API key required).
- `oanda`: Extension point (API key required).

### Example request

`GET /api/market/analyze/?market=forex&symbol=EURUSD=X&interval=15m&range=5d`

### Important note

This is an automated technical analysis engine for research support. Predictions are probabilistic and not guaranteed, and outputs are not financial advice.

## Voucher Marketplace: Provider Integration And Reporting

Voucher-Zone now supports:

- stored-value vouchers and discount vouchers
- catalog purchases (airtime, betting vouchers, food vouchers, etc.)
- provider fulfillment via pluggable adapters
- merchant / partner voucher acceptance across multiple sites
- provider integration records and webhook processing
- reporting dashboard and reporting API

### Voucher routes

- Main dashboard: `/Voucher-Zone/`
- Reporting dashboard: `/Voucher-Zone/reporting/`
- Reporting API: `/api/vouchers/reporting/?days=30`
- Merchant profile API: `/api/vouchers/merchant/profile/`
- Merchant quote API: `/api/vouchers/merchant/quote/`
- Merchant redeem API: `/api/vouchers/merchant/redeem/`
- Provider integrations API: `/api/vouchers/providers/integrations/`
- Provider webhook API: `/api/vouchers/providers/webhook/<provider_slug>/`

### Merchant acceptance flow

Partner sites can accept BAB-issued vouchers by calling the merchant APIs with a merchant key.

- Header: `X-Merchant-Key: babm_demo_local_key`
- Demo merchant slug: `bab-hq-checkout`

Example quote request:

```json
POST /api/vouchers/merchant/quote/
{
  "code": "ABCD-1234",
  "orderAmount": "250.00",
  "reference": "ORDER-1001",
  "channel": "website"
}
```

Example redeem request:

```json
POST /api/vouchers/merchant/redeem/
{
  "code": "ABCD-1234",
  "orderAmount": "250.00",
  "reference": "ORDER-1001",
  "channel": "website",
  "customerName": "Customer Name",
  "customerEmail": "customer@example.com"
}
```

Redeems are idempotent per merchant + voucher + reference, so repeating the same request returns the existing redemption instead of double-spending the voucher.

### Provider integration settings

In `backend/settings.py`, configure provider endpoints and API keys with lowercase provider slugs:

- `VOUCHER_PROVIDER_ENDPOINTS`
- `VOUCHER_PROVIDER_API_KEYS`

Example:

```python
VOUCHER_PROVIDER_ENDPOINTS = {
  "mtn": "https://provider.example.com/topup",
  "betway": "https://provider.example.com/vouchers/betway",
}

VOUCHER_PROVIDER_API_KEYS = {
  "mtn": "YOUR_MTN_KEY",
  "betway": "YOUR_BETWAY_KEY",
}
```

If a provider endpoint is not configured, fulfillment safely falls back to mock mode and still returns a fulfillment code.

### Betway live connection (official integration)

To issue real external vouchers, you need an official Betway partner/API agreement and valid credentials.

Set these environment variables:

```powershell
$env:BETWAY_PROVIDER_ENDPOINT = "https://<official-betway-endpoint>"
$env:BETWAY_PROVIDER_API_KEY = "<official-betway-api-key>"
$env:BETWAY_PROVIDER_AUTH_SCHEME = "bearer"   # or header
$env:BETWAY_PROVIDER_AUTH_HEADER = "Authorization"
$env:BETWAY_PROVIDER_WEBHOOK_SECRET = "<official-webhook-secret>"
```

Then sync and verify integration:

```powershell
python manage.py connect_betway_provider --live
python manage.py probe_betway_provider
```

If credentials are missing, keep Betway in mock mode:

```powershell
python manage.py connect_betway_provider --mock
```

### Database-backed provider integrations

Provider integrations can now also be managed in Django through `ProviderIntegration` records. These records support:

- `mode`: `mock` or `live`
- `endpoint`
- `api_key`
- `auth_scheme`
- `auth_header`
- `timeout_seconds`
- `webhook_secret`

Resolution order for fulfillment config is:

1. `VoucherCatalogItem.metadata`
2. `ProviderIntegration`
3. `backend/settings.py`
4. mock fallback

### Provider webhooks

Providers can notify the system about fulfillment changes through:

- `/api/vouchers/providers/webhook/<provider_slug>/`

If the provider integration has a `webhook_secret`, send it in either:

- `X-Provider-Secret`
- `Authorization: Bearer <secret>`

Webhook events are stored in `ProviderWebhookEvent` and, when a matching purchase reference is found, the purchase status is updated.

### Per-product overrides

You can override provider connection details per catalog item through `VoucherCatalogItem.metadata`:

- `providerEndpoint`
- `providerApiKey`

When these keys are present on a product, they take precedence over global settings.
