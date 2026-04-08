from django.db import migrations


def seed_voucher_network_defaults(apps, schema_editor):
	MerchantPartner = apps.get_model("core", "MerchantPartner")
	ProviderIntegration = apps.get_model("core", "ProviderIntegration")

	MerchantPartner.objects.update_or_create(
		slug="bab-hq-checkout",
		defaults={
			"name": "BAB HQ Checkout",
			"api_key": "babm_demo_local_key",
			"default_channel": "website",
			"supports_all_vouchers": True,
			"accepted_channels": ["website", "app", "pos"],
			"supported_categories": [],
			"supported_providers": [],
			"is_active": True,
			"metadata": {"environment": "local-demo"},
		},
	)

	for provider_slug, display_name in [
		("betway", "Betway"),
		("pearsonvue", "Pearson VUE"),
		("shoprite", "Shoprite"),
		("mtn", "MTN"),
	]:
		ProviderIntegration.objects.update_or_create(
			provider_slug=provider_slug,
			defaults={
				"display_name": display_name,
				"mode": "mock",
				"endpoint": "",
				"api_key": "",
				"auth_scheme": "bearer",
				"auth_header": "Authorization",
				"timeout_seconds": 25,
				"webhook_secret": f"{provider_slug}-demo-secret",
				"is_active": True,
				"metadata": {"environment": "local-demo"},
			},
		)


class Migration(migrations.Migration):

	dependencies = [
		("core", "0011_merchant_partner_provider_integration_and_more"),
	]

	operations = [
		migrations.RunPython(seed_voucher_network_defaults, migrations.RunPython.noop),
	]