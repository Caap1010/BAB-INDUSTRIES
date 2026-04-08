from decimal import Decimal

from django.db import models
from django.utils import timezone
from django.utils.crypto import get_random_string


class PestLead(models.Model):
	name = models.CharField(max_length=120)
	email = models.EmailField()
	subject = models.CharField(max_length=180)
	message = models.TextField()
	request_type = models.CharField(max_length=80, blank=True)
	preferred_contact_time = models.CharField(max_length=80, blank=True)
	source = models.CharField(max_length=40, blank=True)
	ip_address = models.GenericIPAddressField(null=True, blank=True)
	user_agent = models.CharField(max_length=255, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return f"{self.name} - {self.subject}"


class TrailerRecommendation(models.Model):
	MEDIA_CHOICES = [
		("movie", "Movie"),
		("series", "Series"),
		("anime", "Anime"),
	]

	name = models.CharField(max_length=100)
	title = models.CharField(max_length=180)
	media_type = models.CharField(max_length=20, choices=MEDIA_CHOICES)
	recommendation = models.TextField(max_length=900)
	trailer_url = models.URLField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return f"{self.title} ({self.media_type}) by {self.name}"


class MarketPrediction(models.Model):
	class Outcome(models.TextChoices):
		PENDING = "pending", "Pending"
		SL = "sl", "Stop Loss"
		TP1 = "tp1", "TP1"
		TP2 = "tp2", "TP2"
		TP3 = "tp3", "TP3"
		TP4 = "tp4", "TP4"

	market = models.CharField(max_length=24, blank=True)
	symbol = models.CharField(max_length=32)
	interval = models.CharField(max_length=12)
	provider = models.CharField(max_length=40, blank=True)
	provider_label = models.CharField(max_length=80, blank=True)
	symbol_resolved = models.CharField(max_length=32, blank=True)
	trend = models.CharField(max_length=16, blank=True)

	entry = models.FloatField(null=True, blank=True)
	stop_loss = models.FloatField(null=True, blank=True)
	t1 = models.FloatField(null=True, blank=True)
	t2 = models.FloatField(null=True, blank=True)
	t3 = models.FloatField(null=True, blank=True)
	t4 = models.FloatField(null=True, blank=True)

	price_at_call = models.FloatField(null=True, blank=True)
	latest_price = models.FloatField(null=True, blank=True)
	outcome = models.CharField(max_length=12, choices=Outcome.choices, default=Outcome.PENDING)
	resolved_at = models.DateTimeField(null=True, blank=True)
	resolved_price = models.FloatField(null=True, blank=True)
	simulated_pnl = models.FloatField(default=0)
	simulated_r_multiple = models.FloatField(default=0)

	metadata = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["symbol", "interval", "outcome"]),
			models.Index(fields=["created_at"]),
		]

	def __str__(self):
		return f"{self.symbol} {self.interval} {self.outcome}"


class TradeLearningSnapshot(models.Model):
	prediction = models.OneToOneField(MarketPrediction, on_delete=models.CASCADE, related_name="learning_snapshot")
	market = models.CharField(max_length=24, blank=True)
	symbol = models.CharField(max_length=32)
	interval = models.CharField(max_length=12)
	trend = models.CharField(max_length=16, blank=True)
	outcome = models.CharField(max_length=12)
	confidence_score = models.FloatField(default=0)
	risk_reward_ratio = models.FloatField(default=0)
	stop_distance = models.FloatField(default=0)
	stop_distance_pct = models.FloatField(default=0)
	mae = models.FloatField(default=0)
	mfe = models.FloatField(default=0)
	trailing_stop_improvement = models.FloatField(default=0)
	atr14 = models.FloatField(null=True, blank=True)
	close_slope_30 = models.FloatField(null=True, blank=True)
	learning_features = models.JSONField(default=dict, blank=True)
	root_causes = models.JSONField(default=list, blank=True)
	tp_drivers = models.JSONField(default=list, blank=True)
	policy_snapshot = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["symbol", "interval", "outcome"]),
			models.Index(fields=["created_at"]),
		]

	def __str__(self):
		return f"Learning {self.symbol} {self.interval} {self.outcome}"


class AdaptiveTradingPolicy(models.Model):
	scope = models.CharField(max_length=64, unique=True)
	confidence_threshold = models.FloatField(default=58.0)
	min_risk_reward = models.FloatField(default=1.25)
	rollback_count = models.IntegerField(default=0)
	preferred_sessions = models.JSONField(default=list, blank=True)
	blocked_conditions = models.JSONField(default=list, blank=True)
	preferred_conditions = models.JSONField(default=list, blank=True)
	previous_state = models.JSONField(default=dict, blank=True)
	stats = models.JSONField(default=dict, blank=True)
	updated_at = models.DateTimeField(auto_now=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["scope"]

	def __str__(self):
		return f"Policy {self.scope}"


class ProviderHealthEvent(models.Model):
	market = models.CharField(max_length=24, blank=True)
	symbol = models.CharField(max_length=32)
	interval = models.CharField(max_length=12, blank=True)
	provider = models.CharField(max_length=40)
	ok = models.BooleanField(default=False)
	latency_ms = models.IntegerField(default=0)
	error = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["provider", "created_at"]),
			models.Index(fields=["symbol", "created_at"]),
		]

	def __str__(self):
		status = "ok" if self.ok else "fail"
		return f"{self.provider} {self.symbol} {status}"


class AlertDeliveryLog(models.Model):
	prediction = models.ForeignKey(MarketPrediction, on_delete=models.SET_NULL, null=True, blank=True)
	channel = models.CharField(max_length=20)
	status = models.CharField(max_length=20, default="sent")
	message = models.TextField(blank=True)
	error = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["channel", "created_at"]),
		]

	def __str__(self):
		return f"{self.channel} {self.status}"


class PaperTradingAccount(models.Model):
	name = models.CharField(max_length=64, unique=True)
	balance = models.FloatField(default=10000)
	equity = models.FloatField(default=10000)
	peak_equity = models.FloatField(default=10000)
	max_drawdown_pct = models.FloatField(default=0)
	max_risk_per_trade_pct = models.FloatField(default=1.0)
	max_daily_drawdown_pct = models.FloatField(default=4.0)
	max_session_drawdown_pct = models.FloatField(default=2.5)
	daily_start_equity = models.FloatField(default=10000)
	session_start_equity = models.FloatField(default=10000)
	daily_drawdown_pct = models.FloatField(default=0)
	session_drawdown_pct = models.FloatField(default=0)
	last_risk_reset_at = models.DateTimeField(null=True, blank=True)
	risk_state = models.CharField(max_length=20, default="normal")
	win_count = models.IntegerField(default=0)
	loss_count = models.IntegerField(default=0)
	trade_count = models.IntegerField(default=0)
	stats = models.JSONField(default=dict, blank=True)
	updated_at = models.DateTimeField(auto_now=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["name"]

	def __str__(self):
		return f"Paper {self.name}"


class Voucher(models.Model):
	class VoucherKind(models.TextChoices):
		DISCOUNT = "discount", "Discount"
		STORED_VALUE = "stored_value", "Stored value"

	class DiscountType(models.TextChoices):
		FIXED = "fixed", "Fixed amount"
		PERCENT = "percent", "Percentage"

	name = models.CharField(max_length=120)
	code = models.CharField(max_length=40, unique=True)
	voucher_kind = models.CharField(max_length=20, choices=VoucherKind.choices, default=VoucherKind.DISCOUNT)
	discount_type = models.CharField(max_length=12, choices=DiscountType.choices, default=DiscountType.FIXED)
	discount_value = models.DecimalField(max_digits=10, decimal_places=2)
	initial_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
	remaining_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
	currency = models.CharField(max_length=8, default="ZAR")
	is_global = models.BooleanField(default=True)
	allowed_channels = models.JSONField(default=list, blank=True)
	supported_categories = models.JSONField(default=list, blank=True)
	supported_providers = models.JSONField(default=list, blank=True)
	min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
	usage_limit = models.PositiveIntegerField(default=1)
	usage_count = models.PositiveIntegerField(default=0)
	is_active = models.BooleanField(default=True)
	active_from = models.DateTimeField(null=True, blank=True)
	expires_at = models.DateTimeField(null=True, blank=True)
	notes = models.TextField(blank=True)
	metadata = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["code"]),
			models.Index(fields=["voucher_kind", "is_active"]),
			models.Index(fields=["is_active", "expires_at"]),
		]

	def __str__(self):
		return f"{self.code} ({self.name})"

	def save(self, *args, **kwargs):
		if self.voucher_kind == self.VoucherKind.STORED_VALUE:
			if Decimal(str(self.initial_balance or 0)) < 0:
				self.initial_balance = Decimal("0.00")
			if not self.pk and Decimal(str(self.remaining_balance or 0)) <= 0:
				self.remaining_balance = Decimal(str(self.initial_balance or 0))
			if Decimal(str(self.remaining_balance or 0)) < 0:
				self.remaining_balance = Decimal("0.00")
		else:
			self.initial_balance = Decimal("0.00")
			self.remaining_balance = Decimal("0.00")
		super().save(*args, **kwargs)

	def is_available(self, now=None):
		now = now or timezone.now()
		if not self.is_active:
			return False
		if self.active_from and now < self.active_from:
			return False
		if self.expires_at and now > self.expires_at:
			return False
		if self.usage_limit and self.usage_count >= self.usage_limit:
			return False
		return True

	def compute_discount(self, order_amount):
		order_amount = Decimal(str(order_amount or 0))
		if self.voucher_kind == self.VoucherKind.STORED_VALUE:
			available = Decimal(str(self.remaining_balance or 0))
			discount = min(order_amount, available)
			return discount.quantize(Decimal("0.01"))
		if self.discount_type == self.DiscountType.PERCENT:
			discount = (order_amount * Decimal(str(self.discount_value))) / Decimal("100")
		else:
			discount = Decimal(str(self.discount_value))
		if discount > order_amount:
			discount = order_amount
		return discount.quantize(Decimal("0.01"))

	def supports_product(self, product):
		if self.voucher_kind != self.VoucherKind.STORED_VALUE:
			return False
		if not product:
			return False
		if self.is_global:
			return True
		categories = {str(item).strip().lower() for item in (self.supported_categories or []) if str(item).strip()}
		providers = {str(item).strip().lower() for item in (self.supported_providers or []) if str(item).strip()}
		category_ok = not categories or str(product.category or "").strip().lower() in categories
		provider_ok = not providers or str(product.provider or "").strip().lower() in providers
		return category_ok and provider_ok


class VoucherCatalogItem(models.Model):
	class Category(models.TextChoices):
		AIRTIME = "airtime", "Airtime"
		BETTING = "betting", "Betting"
		RETAIL = "retail", "Retail"
		FOOD = "food", "Food"
		DATA = "data", "Data"
		ENTERTAINMENT = "entertainment", "Entertainment"
		EXAM = "exam", "Exam"
		LEARNING = "learning", "Learning"
		ELECTRICITY = "electricity", "Electricity"
		TRANSPORT = "transport", "Transport"
		OTHER = "other", "Other"

	class DeliveryType(models.TextChoices):
		DIGITAL = "digital_voucher", "Digital voucher"
		TOPUP = "topup", "Top up"
		PIN = "pin", "PIN"

	name = models.CharField(max_length=140)
	provider = models.CharField(max_length=120)
	category = models.CharField(max_length=24, choices=Category.choices, default=Category.OTHER)
	delivery_type = models.CharField(max_length=24, choices=DeliveryType.choices, default=DeliveryType.DIGITAL)
	face_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
	sale_price = models.DecimalField(max_digits=10, decimal_places=2)
	currency = models.CharField(max_length=8, default="ZAR")
	requires_recipient = models.BooleanField(default=False)
	recipient_label = models.CharField(max_length=80, blank=True)
	is_active = models.BooleanField(default=True)
	notes = models.TextField(blank=True)
	metadata = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["category", "provider", "name"]
		indexes = [
			models.Index(fields=["category", "provider"]),
			models.Index(fields=["is_active", "category"]),
		]

	def __str__(self):
		return f"{self.provider} {self.name}"


class VoucherPurchase(models.Model):
	class Status(models.TextChoices):
		PENDING = "pending", "Pending"
		FULFILLED = "fulfilled", "Fulfilled"
		FAILED = "failed", "Failed"

	voucher = models.ForeignKey(Voucher, on_delete=models.CASCADE, related_name="purchases")
	product = models.ForeignKey(VoucherCatalogItem, on_delete=models.PROTECT, related_name="purchases")
	reference = models.CharField(max_length=80, blank=True)
	recipient_reference = models.CharField(max_length=120, blank=True)
	customer_name = models.CharField(max_length=120, blank=True)
	customer_email = models.EmailField(blank=True)
	channel = models.CharField(max_length=40, blank=True)
	quantity = models.PositiveIntegerField(default=1)
	total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	fulfillment_code = models.CharField(max_length=80, blank=True)
	fulfillment_details = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["reference", "created_at"]),
			models.Index(fields=["status", "created_at"]),
		]

	def __str__(self):
		return f"{self.voucher.code} -> {self.product.name}"


class MerchantPartner(models.Model):
	name = models.CharField(max_length=120)
	slug = models.SlugField(max_length=80, unique=True)
	api_key = models.CharField(max_length=64, unique=True, blank=True)
	default_channel = models.CharField(max_length=40, blank=True)
	supports_all_vouchers = models.BooleanField(default=True)
	accepted_channels = models.JSONField(default=list, blank=True)
	supported_categories = models.JSONField(default=list, blank=True)
	supported_providers = models.JSONField(default=list, blank=True)
	webhook_url = models.URLField(blank=True)
	is_active = models.BooleanField(default=True)
	metadata = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["name"]
		indexes = [
			models.Index(fields=["slug", "is_active"]),
		]

	def save(self, *args, **kwargs):
		if not self.api_key:
			self.api_key = f"babm_{get_random_string(32, allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz')}"
		super().save(*args, **kwargs)

	def __str__(self):
		return self.name


class ProviderIntegration(models.Model):
	class Mode(models.TextChoices):
		MOCK = "mock", "Mock"
		LIVE = "live", "Live"

	class AuthScheme(models.TextChoices):
		NONE = "none", "None"
		BEARER = "bearer", "Bearer"
		HEADER = "header", "Header value"

	provider_slug = models.SlugField(max_length=80, unique=True)
	display_name = models.CharField(max_length=120)
	mode = models.CharField(max_length=16, choices=Mode.choices, default=Mode.MOCK)
	endpoint = models.URLField(blank=True)
	api_key = models.CharField(max_length=255, blank=True)
	auth_scheme = models.CharField(max_length=16, choices=AuthScheme.choices, default=AuthScheme.BEARER)
	auth_header = models.CharField(max_length=80, default="Authorization")
	timeout_seconds = models.PositiveIntegerField(default=25)
	webhook_secret = models.CharField(max_length=255, blank=True)
	is_active = models.BooleanField(default=True)
	metadata = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["provider_slug"]
		indexes = [
			models.Index(fields=["provider_slug", "is_active"]),
		]

	def __str__(self):
		return self.display_name or self.provider_slug


class VoucherRedemption(models.Model):
	merchant = models.ForeignKey("MerchantPartner", on_delete=models.SET_NULL, null=True, blank=True, related_name="redemptions")
	voucher = models.ForeignKey(Voucher, on_delete=models.CASCADE, related_name="redemptions")
	reference = models.CharField(max_length=80, blank=True)
	customer_name = models.CharField(max_length=120, blank=True)
	customer_email = models.EmailField(blank=True)
	channel = models.CharField(max_length=40, blank=True)
	order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
	discount_applied = models.DecimalField(max_digits=10, decimal_places=2, default=0)
	final_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
	metadata = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["reference", "created_at"]),
			models.Index(fields=["channel", "created_at"]),
		]

	def __str__(self):
		return f"{self.voucher.code} redemption"


class ProviderWebhookEvent(models.Model):
	integration = models.ForeignKey(ProviderIntegration, on_delete=models.SET_NULL, null=True, blank=True, related_name="webhook_events")
	purchase = models.ForeignKey(VoucherPurchase, on_delete=models.SET_NULL, null=True, blank=True, related_name="webhook_events")
	provider_slug = models.SlugField(max_length=80)
	event_type = models.CharField(max_length=80, blank=True)
	reference = models.CharField(max_length=120, blank=True)
	headers = models.JSONField(default=dict, blank=True)
	payload = models.JSONField(default=dict, blank=True)
	processed = models.BooleanField(default=False)
	status = models.CharField(max_length=20, default="received")
	message = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["provider_slug", "created_at"]),
			models.Index(fields=["reference", "created_at"]),
		]

	def __str__(self):
		return f"{self.provider_slug} webhook {self.status}"


# ──────────────────────────────────────────────────────────────────────
# CREDIT CHECK
# ──────────────────────────────────────────────────────────────────────

class Debtor(models.Model):
	first_name = models.CharField(max_length=80)
	last_name = models.CharField(max_length=80)
	id_number = models.CharField(max_length=13, unique=True)
	phone = models.CharField(max_length=20, blank=True)
	email = models.EmailField(blank=True)
	address = models.TextField(blank=True)
	notes = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["last_name", "first_name"]
		indexes = [
			models.Index(fields=["id_number"]),
			models.Index(fields=["last_name", "first_name"]),
		]

	def __str__(self):
		return f"{self.first_name} {self.last_name} ({self.id_number})"

	@property
	def full_name(self):
		return f"{self.first_name} {self.last_name}"

	@property
	def total_outstanding(self):
		from decimal import Decimal
		return sum(
			d.outstanding_balance for d in self.debts.filter(status__in=["current", "overdue"])
		) or Decimal("0.00")


class Debt(models.Model):
	class DebtType(models.TextChoices):
		PERSONAL_LOAN = "personal_loan", "Personal Loan"
		STORE_CREDIT = "store_credit", "Store Credit"
		VEHICLE_FINANCE = "vehicle_finance", "Vehicle Finance"
		HOME_LOAN = "home_loan", "Home Loan"
		MEDICAL = "medical", "Medical"
		CREDIT_CARD = "credit_card", "Credit Card"
		STUDENT_LOAN = "student_loan", "Student Loan"
		BUSINESS_LOAN = "business_loan", "Business Loan"
		UTILITY = "utility", "Utility / Municipal"
		OTHER = "other", "Other"

	class Status(models.TextChoices):
		CURRENT = "current", "Current"
		OVERDUE = "overdue", "Overdue"
		PAID = "paid", "Paid"
		WRITTEN_OFF = "written_off", "Written Off"
		IN_DISPUTE = "in_dispute", "In Dispute"

	debtor = models.ForeignKey(Debtor, on_delete=models.CASCADE, related_name="debts")
	creditor = models.CharField(max_length=120)
	debt_type = models.CharField(max_length=20, choices=DebtType.choices, default=DebtType.OTHER)
	original_amount = models.DecimalField(max_digits=12, decimal_places=2)
	outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2)
	monthly_installment = models.DecimalField(max_digits=10, decimal_places=2, default=0)
	interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Annual % rate")
	due_date = models.DateField(null=True, blank=True)
	status = models.CharField(max_length=15, choices=Status.choices, default=Status.CURRENT)
	months_overdue = models.PositiveIntegerField(default=0)
	notes = models.TextField(blank=True)
	reference = models.CharField(max_length=80, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["debtor", "status"]),
			models.Index(fields=["status"]),
		]

	def __str__(self):
		return f"{self.debtor.full_name} – {self.creditor} R{self.outstanding_balance} ({self.status})"
