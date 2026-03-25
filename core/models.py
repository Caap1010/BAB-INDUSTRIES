from django.db import models


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
