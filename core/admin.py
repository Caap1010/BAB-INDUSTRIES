from django.contrib import admin

from .models import (
	AlertDeliveryLog,
	Debt,
	Debtor,
	MarketPrediction,
	MerchantPartner,
	PestLead,
	ProviderIntegration,
	ProviderHealthEvent,
	ProviderWebhookEvent,
	TrailerRecommendation,
	Voucher,
	VoucherCatalogItem,
	VoucherPurchase,
	VoucherRedemption,
)


@admin.register(PestLead)
class PestLeadAdmin(admin.ModelAdmin):
	list_display = ("id", "name", "email", "subject", "created_at")
	search_fields = ("name", "email", "subject")
	list_filter = ("created_at",)


@admin.register(TrailerRecommendation)
class TrailerRecommendationAdmin(admin.ModelAdmin):
	list_display = ("id", "name", "title", "media_type", "created_at")
	search_fields = ("name", "title", "recommendation")
	list_filter = ("media_type", "created_at")


@admin.register(MarketPrediction)
class MarketPredictionAdmin(admin.ModelAdmin):
	list_display = ("id", "symbol", "interval", "outcome", "provider", "created_at", "resolved_at")
	search_fields = ("symbol", "interval", "provider", "symbol_resolved")
	list_filter = ("outcome", "interval", "provider", "market", "created_at")


@admin.register(ProviderHealthEvent)
class ProviderHealthEventAdmin(admin.ModelAdmin):
	list_display = ("id", "provider", "symbol", "market", "interval", "ok", "latency_ms", "created_at")
	search_fields = ("provider", "symbol", "market", "interval")
	list_filter = ("provider", "ok", "market", "interval", "created_at")


@admin.register(AlertDeliveryLog)
class AlertDeliveryLogAdmin(admin.ModelAdmin):
	list_display = ("id", "channel", "status", "prediction", "created_at")
	search_fields = ("channel", "status", "message", "error")
	list_filter = ("channel", "status", "created_at")


@admin.register(Debtor)
class DebtorAdmin(admin.ModelAdmin):
	list_display = ("id", "first_name", "last_name", "id_number", "phone", "email", "created_at")
	search_fields = ("first_name", "last_name", "id_number", "phone", "email")
	list_filter = ("created_at",)


@admin.register(Debt)
class DebtAdmin(admin.ModelAdmin):
	list_display = ("id", "debtor", "creditor", "debt_type", "original_amount", "outstanding_balance", "status", "months_overdue", "due_date")
	search_fields = ("debtor__first_name", "debtor__last_name", "debtor__id_number", "creditor", "reference")
	list_filter = ("status", "debt_type", "created_at")
	raw_id_fields = ("debtor",)

@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
	list_display = (
		"id",
		"code",
		"name",
		"voucher_kind",
		"discount_type",
		"discount_value",
		"remaining_balance",
		"usage_count",
		"usage_limit",
		"is_active",
		"is_global",
		"expires_at",
	)
	search_fields = ("code", "name", "notes")
	list_filter = ("voucher_kind", "discount_type", "is_active", "is_global", "currency", "created_at")


@admin.register(VoucherCatalogItem)
class VoucherCatalogItemAdmin(admin.ModelAdmin):
	list_display = ("id", "provider", "name", "category", "sale_price", "currency", "is_active")
	search_fields = ("provider", "name", "notes")
	list_filter = ("category", "delivery_type", "is_active", "currency", "created_at")


@admin.register(VoucherPurchase)
class VoucherPurchaseAdmin(admin.ModelAdmin):
	list_display = ("id", "voucher", "product", "reference", "channel", "quantity", "total_amount", "status", "created_at")
	search_fields = ("reference", "recipient_reference", "customer_name", "customer_email", "voucher__code", "product__name")
	list_filter = ("status", "channel", "created_at")


@admin.register(MerchantPartner)
class MerchantPartnerAdmin(admin.ModelAdmin):
	list_display = ("id", "name", "slug", "default_channel", "supports_all_vouchers", "is_active", "created_at")
	search_fields = ("name", "slug", "api_key")
	list_filter = ("supports_all_vouchers", "is_active", "created_at")


@admin.register(ProviderIntegration)
class ProviderIntegrationAdmin(admin.ModelAdmin):
	list_display = ("id", "provider_slug", "display_name", "mode", "endpoint", "is_active", "updated_at")
	search_fields = ("provider_slug", "display_name", "endpoint")
	list_filter = ("mode", "is_active", "updated_at")


@admin.register(VoucherRedemption)
class VoucherRedemptionAdmin(admin.ModelAdmin):
	list_display = ("id", "voucher", "merchant", "reference", "channel", "discount_applied", "final_amount", "created_at")
	search_fields = ("reference", "customer_name", "customer_email", "voucher__code")
	list_filter = ("channel", "created_at")


@admin.register(ProviderWebhookEvent)
class ProviderWebhookEventAdmin(admin.ModelAdmin):
	list_display = ("id", "provider_slug", "event_type", "reference", "status", "processed", "created_at")
	search_fields = ("provider_slug", "event_type", "reference", "message")
	list_filter = ("provider_slug", "status", "processed", "created_at")
