from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

	dependencies = [
		("core", "0010_voucher_code_format_metadata"),
	]

	operations = [
		migrations.CreateModel(
			name="MerchantPartner",
			fields=[
				("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
				("name", models.CharField(max_length=120)),
				("slug", models.SlugField(max_length=80, unique=True)),
				("api_key", models.CharField(blank=True, max_length=64, unique=True)),
				("default_channel", models.CharField(blank=True, max_length=40)),
				("supports_all_vouchers", models.BooleanField(default=True)),
				("accepted_channels", models.JSONField(blank=True, default=list)),
				("supported_categories", models.JSONField(blank=True, default=list)),
				("supported_providers", models.JSONField(blank=True, default=list)),
				("webhook_url", models.URLField(blank=True)),
				("is_active", models.BooleanField(default=True)),
				("metadata", models.JSONField(blank=True, default=dict)),
				("created_at", models.DateTimeField(auto_now_add=True)),
				("updated_at", models.DateTimeField(auto_now=True)),
			],
			options={
				"ordering": ["name"],
				"indexes": [models.Index(fields=["slug", "is_active"], name="core_mercha_slug_3e4706_idx")],
			},
		),
		migrations.CreateModel(
			name="ProviderIntegration",
			fields=[
				("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
				("provider_slug", models.SlugField(max_length=80, unique=True)),
				("display_name", models.CharField(max_length=120)),
				("mode", models.CharField(choices=[("mock", "Mock"), ("live", "Live")], default="mock", max_length=16)),
				("endpoint", models.URLField(blank=True)),
				("api_key", models.CharField(blank=True, max_length=255)),
				("auth_scheme", models.CharField(choices=[("none", "None"), ("bearer", "Bearer"), ("header", "Header value")], default="bearer", max_length=16)),
				("auth_header", models.CharField(default="Authorization", max_length=80)),
				("timeout_seconds", models.PositiveIntegerField(default=25)),
				("webhook_secret", models.CharField(blank=True, max_length=255)),
				("is_active", models.BooleanField(default=True)),
				("metadata", models.JSONField(blank=True, default=dict)),
				("created_at", models.DateTimeField(auto_now_add=True)),
				("updated_at", models.DateTimeField(auto_now=True)),
			],
			options={
				"ordering": ["provider_slug"],
				"indexes": [models.Index(fields=["provider_slug", "is_active"], name="core_provid_provide_72f6d0_idx")],
			},
		),
		migrations.AddField(
			model_name="voucherredemption",
			name="merchant",
			field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="redemptions", to="core.merchantpartner"),
		),
		migrations.CreateModel(
			name="ProviderWebhookEvent",
			fields=[
				("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
				("provider_slug", models.SlugField(max_length=80)),
				("event_type", models.CharField(blank=True, max_length=80)),
				("reference", models.CharField(blank=True, max_length=120)),
				("headers", models.JSONField(blank=True, default=dict)),
				("payload", models.JSONField(blank=True, default=dict)),
				("processed", models.BooleanField(default=False)),
				("status", models.CharField(default="received", max_length=20)),
				("message", models.TextField(blank=True)),
				("created_at", models.DateTimeField(auto_now_add=True)),
				("updated_at", models.DateTimeField(auto_now=True)),
				("integration", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="webhook_events", to="core.providerintegration")),
				("purchase", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="webhook_events", to="core.voucherpurchase")),
			],
			options={
				"ordering": ["-created_at"],
				"indexes": [
					models.Index(fields=["provider_slug", "created_at"], name="core_provid_provide_9e2328_idx"),
					models.Index(fields=["reference", "created_at"], name="core_provid_referen_010ea1_idx"),
				],
			},
		),
	]