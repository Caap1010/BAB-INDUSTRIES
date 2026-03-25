# BAB Watch

Trailer-first community website for BAB Watch.

## Files

- index.html
- style.css
- script.js
- images/bab-watch-logo.png (preferred file for your pasted logo)
- images/bab-watch-logo.svg (fallback logo)

## Live Catalog Setup

- This site uses TMDB for legal metadata discovery and YouTube trailer links.
- Frontend users do not enter any API key.
- Configure the key on the server as environment variable `TMDB_API_KEY`.
- Example (PowerShell): `$env:TMDB_API_KEY="your_tmdb_key"`
- Run backend: `python manage.py runserver`

## Community Features

- Trailer discovery by search, year, genre, provider, and region.
- In-app trailer modal playback from official YouTube trailer links.
- Shared recommendation feed backed by `/api/bab-watch/recommendations/`.
- Community post form for movie, series, and anime recommendations.

## Notes

- Cinema titles are shown for discovery, trailers, release info, and booking links.
- Trailer and watch-source availability is rights-based and depends on licensing/region.
- "Where to Watch" links depend on provider data available in selected region.
