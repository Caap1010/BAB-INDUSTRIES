from django.urls import path

from .views import (
    bab_watch_discover,
    bab_watch_genres,
    bab_watch_providers,
    bab_watch_recommendations,
    bab_watch_trending,
    bab_watch_trailer,
    bab_watch_watch_link,
    create_pest_lead,
    pest_lead_dashboard,
    pest_lead_list,
)

urlpatterns = [
    path("api/pest-leads/", create_pest_lead, name="create_pest_lead"),
    path("api/pest-leads/list/", pest_lead_list, name="pest_lead_list"),
    path("api/bab-watch/genres/", bab_watch_genres, name="bab_watch_genres"),
    path("api/bab-watch/providers/", bab_watch_providers, name="bab_watch_providers"),
    path("api/bab-watch/discover/", bab_watch_discover, name="bab_watch_discover"),
    path("api/bab-watch/trending/", bab_watch_trending, name="bab_watch_trending"),
    path("api/bab-watch/trailer/", bab_watch_trailer, name="bab_watch_trailer"),
    path("api/bab-watch/watch-link/", bab_watch_watch_link, name="bab_watch_watch_link"),
    path("api/bab-watch/recommendations/", bab_watch_recommendations, name="bab_watch_recommendations"),
    path("pest-control/dashboard/", pest_lead_dashboard, name="pest_lead_dashboard"),
]
