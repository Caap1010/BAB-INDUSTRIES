from django.urls import path

from .views import create_pest_lead, pest_lead_dashboard, pest_lead_list

urlpatterns = [
    path("api/pest-leads/", create_pest_lead, name="create_pest_lead"),
    path("api/pest-leads/list/", pest_lead_list, name="pest_lead_list"),
    path("pest-control/dashboard/", pest_lead_dashboard, name="pest_lead_dashboard"),
]
