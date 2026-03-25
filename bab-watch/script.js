const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

const controls = {
    discoverForm: document.getElementById("discoverForm"),
    queryInput: document.getElementById("queryInput"),
    mediaType: document.getElementById("mediaType"),
    region: document.getElementById("region"),
    year: document.getElementById("year"),
    genre: document.getElementById("genre"),
    provider: document.getElementById("provider"),
    statusText: document.getElementById("statusText"),
    catalogGrid: document.getElementById("catalogGrid"),
    trailerGrid: document.getElementById("trailerGrid"),
    movieGrid: document.getElementById("movieGrid"),
    seriesGrid: document.getElementById("seriesGrid"),
    cinemaGrid: document.getElementById("cinemaGrid"),
    prevPage: document.getElementById("prevPage"),
    nextPage: document.getElementById("nextPage"),
    pageInfo: document.getElementById("pageInfo"),
    playerModal: document.getElementById("playerModal"),
    closePlayer: document.getElementById("closePlayer"),
    playerTitle: document.getElementById("playerTitle"),
    iframePlayer: document.getElementById("iframePlayer"),
    recForm: document.getElementById("recForm"),
    recName: document.getElementById("recName"),
    recTitle: document.getElementById("recTitle"),
    recMediaType: document.getElementById("recMediaType"),
    recTrailerUrl: document.getElementById("recTrailerUrl"),
    recText: document.getElementById("recText"),
    communityStatus: document.getElementById("communityStatus"),
    communityList: document.getElementById("communityList"),
    communityCta: document.getElementById("communityCta")
};

const state = {
    page: 1,
    totalPages: 1,
    watchRegion: "ZA"
};

function setStatus(message) {
    controls.statusText.textContent = message;
}

function setCommunityStatus(message) {
    controls.communityStatus.textContent = message;
}

function apiUrl(path, params = {}) {
    const url = new URL(path, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
        }
    });
    return url.toString();
}

async function apiGet(path, params = {}) {
    const response = await fetch(apiUrl(path, params));
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }
    return response.json();
}

async function apiPost(path, payload) {
    const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

function buildYearOptions() {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1888; year -= 1) {
        const option = document.createElement("option");
        option.value = String(year);
        option.textContent = String(year);
        controls.year.appendChild(option);
    }
}

function cardPosterPath(item) {
    if (!item.poster_path) return "";
    return `${TMDB_IMG}${item.poster_path}`;
}

function titleFor(item, mediaType) {
    return mediaType === "movie" ? item.title : item.name;
}

function yearFor(item, mediaType) {
    const rawDate = mediaType === "movie" ? item.release_date : item.first_air_date;
    return rawDate ? rawDate.slice(0, 4) : "N/A";
}

function getYoutubeEmbedUrl(url) {
    if (!url) return "";
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch && watchMatch[1]) {
        return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1`;
    }
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch && shortMatch[1]) {
        return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=1`;
    }
    const embedMatch = url.match(/youtube\.com\/embed\/([^?&]+)/);
    if (embedMatch && embedMatch[1]) {
        return `https://www.youtube.com/embed/${embedMatch[1]}?autoplay=1`;
    }
    return "";
}

async function fetchWatchLink(mediaType, id, region) {
    try {
        const result = await apiGet("/api/bab-watch/watch-link/", {
            media_type: mediaType,
            tmdb_id: id,
            region
        });
        return result.link || "";
    } catch (_) {
        return "";
    }
}

async function fetchTrailerLink(mediaType, id) {
    try {
        const result = await apiGet("/api/bab-watch/trailer/", {
            media_type: mediaType,
            tmdb_id: id
        });
        return result.trailer || "";
    } catch (_) {
        return "";
    }
}

function updatePagingButtons() {
    controls.pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;
    controls.prevPage.disabled = state.page <= 1;
    controls.nextPage.disabled = state.page >= state.totalPages;
}

function openTrailerModal(title, trailerUrl) {
    const embedUrl = getYoutubeEmbedUrl(trailerUrl);
    if (!embedUrl) {
        setStatus("Trailer embed unavailable for this title.");
        return;
    }

    controls.playerTitle.textContent = title;
    controls.iframePlayer.src = embedUrl;
    controls.playerModal.classList.add("modal-open");
    controls.playerModal.setAttribute("aria-hidden", "false");
}

function closeTrailerModal() {
    controls.playerModal.classList.remove("modal-open");
    controls.playerModal.setAttribute("aria-hidden", "true");
    controls.iframePlayer.removeAttribute("src");
}

function attachTrailerButtons(scope = document) {
    scope.querySelectorAll("[data-trailer]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
            event.preventDefault();
            const trailerUrl = btn.getAttribute("data-trailer");
            const title = btn.getAttribute("data-title") || "Trailer";
            if (trailerUrl) {
                openTrailerModal(title, trailerUrl);
            }
        });
    });
}

function renderMediaCards(targetEl, items, mediaType, watchLinkMap = {}, trailerLinkMap = {}) {
    targetEl.innerHTML = items
        .map((item) => {
            const title = titleFor(item, mediaType);
            const year = yearFor(item, mediaType);
            const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
            const poster = cardPosterPath(item);
            const tmdbDetailUrl = `https://www.themoviedb.org/${mediaType}/${item.id}`;
            const watchLink = watchLinkMap[item.id] || "";
            const trailerLink = trailerLinkMap[item.id] || "";
            const watchButton = watchLink
                ? `<a href="${watchLink}" target="_blank" rel="noopener noreferrer">Where to Watch</a>`
                : `<a href="${tmdbDetailUrl}" target="_blank" rel="noopener noreferrer">Title Details</a>`;
            const trailerButton = trailerLink
                ? `<a href="#" data-trailer="${trailerLink}" data-title="${title}">Watch Trailer</a>`
                : "";

            return `
      <article class="content-card">
        <div class="content-thumb">
          ${poster ? `<img src="${poster}" alt="${title} poster" loading="lazy" />` : title}
        </div>
        <div class="content-body">
          <h3>${title}</h3>
          <p>${year} • Rating ${rating}</p>
          <div class="content-actions">
            ${trailerButton}
            ${watchButton}
            <a href="${tmdbDetailUrl}" target="_blank" rel="noopener noreferrer">TMDB</a>
          </div>
        </div>
      </article>
      `;
        })
        .join("");

    attachTrailerButtons(targetEl);
}

function renderCommunity(items) {
    if (!items.length) {
        controls.communityList.innerHTML = `<div class="community-card"><p class="community-body">No recommendations yet. Be the first to post one.</p></div>`;
        return;
    }

    controls.communityList.innerHTML = items
        .map((item) => {
            const date = new Date(item.created_at).toLocaleString();
            const trailerLink = item.trailer_url
                ? `<a href="#" data-trailer="${item.trailer_url}" data-title="${item.title}">Watch shared trailer</a>`
                : "";
            return `
      <article class="community-card">
        <h3>${item.title}</h3>
        <p class="community-meta">${item.media_type.toUpperCase()} • by ${item.name} • ${date}</p>
        <p class="community-body">${item.recommendation}</p>
        ${trailerLink}
      </article>
      `;
        })
        .join("");

    attachTrailerButtons(controls.communityList);
}

async function loadGenres() {
    const mediaType = controls.mediaType.value;
    controls.genre.innerHTML = `<option value="">All Genres</option>`;

    const data = await apiGet("/api/bab-watch/genres/", { media_type: mediaType });
    (data.genres || []).forEach((genre) => {
        const option = document.createElement("option");
        option.value = String(genre.id);
        option.textContent = genre.name;
        controls.genre.appendChild(option);
    });
}

async function loadProviders() {
    const mediaType = controls.mediaType.value;
    const region = controls.region.value;
    controls.provider.innerHTML = `<option value="">All Providers</option>`;

    const data = await apiGet("/api/bab-watch/providers/", { media_type: mediaType, region });
    (data.results || []).slice(0, 100).forEach((provider) => {
        const option = document.createElement("option");
        option.value = String(provider.provider_id);
        option.textContent = provider.provider_name;
        controls.provider.appendChild(option);
    });
}

async function discoverCatalog() {
    const mediaType = controls.mediaType.value;
    const region = controls.region.value;
    const query = controls.queryInput.value.trim();
    const year = controls.year.value;
    const genre = controls.genre.value;
    const provider = controls.provider.value;

    state.watchRegion = region;

    setStatus("Loading trailer catalog...");

    const data = await apiGet("/api/bab-watch/discover/", {
        media_type: mediaType,
        region,
        page: state.page,
        query,
        year,
        genre,
        provider
    });

    state.totalPages = Math.min(data.total_pages || 1, 500);
    const items = (data.results || []).slice(0, 16);

    const linkEntries = await Promise.all(
        items.map(async (item) => {
            const [watch, trailer] = await Promise.all([
                fetchWatchLink(mediaType, item.id, region),
                fetchTrailerLink(mediaType, item.id)
            ]);
            return [item.id, { watch, trailer }];
        })
    );

    const watchLinkMap = {};
    const trailerLinkMap = {};
    linkEntries.forEach(([id, links]) => {
        watchLinkMap[id] = links.watch;
        trailerLinkMap[id] = links.trailer;
    });

    renderMediaCards(controls.catalogGrid, items, mediaType, watchLinkMap, trailerLinkMap);

    const resultCount = data.total_results || 0;
    setStatus(`Showing ${items.length} titles • ${resultCount.toLocaleString()} result(s) found.`);
    updatePagingButtons();
}

async function loadTrailerRows() {
    const data = await apiGet("/api/bab-watch/trending/", { region: controls.region.value });

    const movieItems = (data.movies || []).slice(0, 8);
    const seriesItems = (data.series || []).slice(0, 8);
    const trailerItems = (data.movies || []).slice(0, 12);
    const cinemaItems = (data.cinema || []).slice(0, 6);

    const movieTrailerLinks = Object.fromEntries(
        await Promise.all(movieItems.map(async (item) => [item.id, await fetchTrailerLink("movie", item.id)]))
    );
    const seriesTrailerLinks = Object.fromEntries(
        await Promise.all(seriesItems.map(async (item) => [item.id, await fetchTrailerLink("tv", item.id)]))
    );
    const trailerGridLinks = Object.fromEntries(
        await Promise.all(trailerItems.map(async (item) => [item.id, await fetchTrailerLink("movie", item.id)]))
    );

    renderMediaCards(controls.movieGrid, movieItems, "movie", {}, movieTrailerLinks);
    renderMediaCards(controls.seriesGrid, seriesItems, "tv", {}, seriesTrailerLinks);
    renderMediaCards(controls.trailerGrid, trailerItems, "movie", {}, trailerGridLinks);

    controls.cinemaGrid.innerHTML = cinemaItems
        .map((item) => {
            const poster = cardPosterPath(item);
            const tmdbDetailUrl = `https://www.themoviedb.org/movie/${item.id}`;
            return `
      <article class="cinema-card">
        <div class="cinema-thumb">${poster ? `<img src="${poster}" alt="${item.title} poster" loading="lazy" />` : item.title}</div>
        <div class="cinema-body">
          <h3>${item.title}</h3>
          <p>In cinemas / recent release • ${yearFor(item, "movie")}</p>
          <div class="content-actions">
            <a href="${tmdbDetailUrl}" target="_blank" rel="noopener noreferrer">Details</a>
          </div>
          <span class="cinema-tag">Cinema Listing</span>
        </div>
      </article>
      `;
        })
        .join("");
}

async function loadCommunityRecommendations() {
    setCommunityStatus("Loading community recommendations...");
    const data = await apiGet("/api/bab-watch/recommendations/");
    renderCommunity(data.items || []);
    setCommunityStatus(`Showing ${data.count || 0} recommendation(s).`);
}

async function submitRecommendation(event) {
    event.preventDefault();

    const payload = {
        name: controls.recName.value.trim(),
        title: controls.recTitle.value.trim(),
        mediaType: controls.recMediaType.value,
        recommendation: controls.recText.value.trim(),
        trailerUrl: controls.recTrailerUrl.value.trim()
    };

    if (!payload.name || !payload.title || !payload.recommendation) {
        setCommunityStatus("Please fill in name, title, and recommendation.");
        return;
    }

    try {
        await apiPost("/api/bab-watch/recommendations/", payload);
        controls.recForm.reset();
        setCommunityStatus("Recommendation posted.");
        await loadCommunityRecommendations();
    } catch (error) {
        setCommunityStatus("Could not post recommendation. Try again.");
    }
}

async function bootstrap() {
    try {
        buildYearOptions();
        await Promise.all([loadGenres(), loadProviders()]);
        await Promise.all([discoverCatalog(), loadTrailerRows(), loadCommunityRecommendations()]);
    } catch (error) {
        setStatus("Unable to load live data. Start Django server and set TMDB_API_KEY on server.");
        setCommunityStatus("Community API unavailable right now.");
    }
}

controls.mediaType.addEventListener("change", async () => {
    state.page = 1;
    await Promise.all([loadGenres(), loadProviders()]);
    await discoverCatalog();
});

controls.region.addEventListener("change", async () => {
    state.page = 1;
    await Promise.all([loadProviders(), discoverCatalog(), loadTrailerRows()]);
});

controls.discoverForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.page = 1;
    await discoverCatalog();
});

controls.prevPage.addEventListener("click", async () => {
    if (state.page <= 1) return;
    state.page -= 1;
    await discoverCatalog();
});

controls.nextPage.addEventListener("click", async () => {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    await discoverCatalog();
});

controls.closePlayer.addEventListener("click", closeTrailerModal);
controls.playerModal.addEventListener("click", (event) => {
    if (event.target === controls.playerModal) {
        closeTrailerModal();
    }
});

controls.recForm.addEventListener("submit", submitRecommendation);
controls.communityCta.addEventListener("click", () => {
    document.getElementById("community").scrollIntoView({ behavior: "smooth" });
    controls.recName.focus();
});

bootstrap();
