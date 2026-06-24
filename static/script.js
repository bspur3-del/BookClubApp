document.addEventListener("DOMContentLoaded", () => {
  initStarPickers();
  loadBookCovers();

  const bookId = document.body.dataset.bookId;
  const memberId = document.body.dataset.memberId;
  const clubPage = document.body.dataset.clubPage;

  if (bookId) loadGroupRec(bookId);
  if (bookId && document.body.dataset.hasNotes) loadMeetingSummary(bookId);
  if (memberId) loadMemberRec(memberId);
  if (memberId) loadMemberPersonality(memberId);
  if (clubPage) { loadGroupPersonality(); loadClubRec(); }

  const nominationBtn = document.getElementById("nominationBtn");
  if (nominationBtn) {
    nominationBtn.addEventListener("click", () => {
      const theme = document.getElementById("nominationTheme").value.trim();
      if (theme) loadNominationSuggestions(theme);
    });
    document.getElementById("nominationTheme").addEventListener("keydown", (e) => {
      if (e.key === "Enter") nominationBtn.click();
    });
  }
});

function initStarPickers() {
  document.querySelectorAll(".star-picker").forEach((picker) => {
    const stars = picker.querySelectorAll(".star-btn");
    const memberId = picker.dataset.member;
    // Support both plain member ID and compound "bookId_memberId" forms
    const input = document.getElementById(`rating_${memberId}`) ||
                  picker.querySelector("input[type=hidden]");
    if (!input) return;

    stars.forEach((star) => {
      // Hover effects only for real mouse pointers — not touch
      star.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "mouse") highlight(stars, star.dataset.value);
      });
      star.addEventListener("pointerleave", (e) => {
        if (e.pointerType === "mouse") restoreActive(stars, input.value);
      });

      // Only register a rating when the pointer didn't move (deliberate tap/click,
      // not a scroll gesture passing over the element)
      let downX, downY;
      star.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });
      star.addEventListener("pointerup", (e) => {
        if (Math.abs(e.clientX - downX) < 8 && Math.abs(e.clientY - downY) < 8) {
          input.value = star.dataset.value;
          setActive(stars, star.dataset.value);
        }
      });
    });
  });
}

function highlight(stars, upTo) {
  stars.forEach((s) => s.classList.toggle("active", parseInt(s.dataset.value) <= parseInt(upTo)));
}

function restoreActive(stars, value) {
  stars.forEach((s) => s.classList.toggle("active", parseInt(s.dataset.value) <= parseInt(value)));
}

function setActive(stars, value) {
  stars.forEach((s) => s.classList.toggle("active", parseInt(s.dataset.value) <= parseInt(value)));
}

// ── Book cover fetching ────────────────────────────────────────────────

// Fallback cover URLs for books the search APIs struggle to find.
// Values can be a string (single URL) or array (tried in order until one loads).
const HARDCODED_COVERS = {
  "house of smoke":           "https://books.google.com/books/content?id=i2o4EQAAQBAJ&printsec=frontcover&img=1&zoom=1",
  "guilty until innocent":   ["https://covers.openlibrary.org/b/isbn/9781400344611-M.jpg",
                               "https://covers.openlibrary.org/b/isbn/9781400344475-M.jpg",
                               "https://books.google.com/books/content?id=r-PR0AEACAAJ&printsec=frontcover&img=1&zoom=1"],
  "if or when i call":        ["https://covers.openlibrary.org/b/isbn/9780998555461-M.jpg",
                               "https://books.google.com/books/content?id=robYzQEACAAJ&printsec=frontcover&img=1&zoom=1"],
  "where the waves turn back":"https://covers.openlibrary.org/b/isbn/9781546003441-M.jpg",
  "once there were wolves":  "https://covers.openlibrary.org/b/isbn/9781250244147-M.jpg",
  "kings of the wyld":       ["https://covers.openlibrary.org/b/isbn/9780316362474-M.jpg",
                               "https://covers.openlibrary.org/b/isbn/9780316362481-M.jpg",
                               "https://covers.openlibrary.org/b/isbn/9780316362498-M.jpg"],
  "when the cranes fly south": ["https://books.google.com/books/content?id=-04vEQAAQBAJ&printsec=frontcover&img=1&zoom=1",
                                 "https://covers.openlibrary.org/b/isbn/9798217006731-M.jpg"],
};

const COVER_MISS_TTL = 7 * 24 * 60 * 60 * 1000; // retry "not found" after 7 days

function coverCacheGet(key) {
  try {
    const raw = localStorage.getItem("bc_" + key);
    if (!raw) return undefined;
    const { url, ts } = JSON.parse(raw);
    // Keep found covers forever; retry misses after 7 days
    if (!url && Date.now() - ts > COVER_MISS_TTL) {
      localStorage.removeItem("bc_" + key);
      return undefined;
    }
    return url; // null = confirmed no cover, string = URL
  } catch { return undefined; }
}

function coverCacheSet(key, url) {
  try { localStorage.setItem("bc_" + key, JSON.stringify({ url, ts: Date.now() })); } catch {}
}

async function fetchFromOpenLibrary(title, author) {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5&fields=cover_i`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    if (data.docs) {
      for (const doc of data.docs) {
        if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
      }
    }
  } catch {}
  return null;
}

async function fetchFromGoogleBooks(title, author) {
  try {
    const q = encodeURIComponent(`${title} ${author}`);
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5&printType=books`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    if (data.items) {
      for (const item of data.items) {
        const links = item.volumeInfo && item.volumeInfo.imageLinks;
        if (links) {
          const raw = links.thumbnail || links.smallThumbnail;
          if (raw) return raw.replace(/^http:\/\//i, "https://").replace("&edge=curl", "");
        }
      }
    }
  } catch {}
  return null;
}

function probeImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 10 ? url : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function fetchBookCover(title, author) {
  const key = `${title}|${author}`.toLowerCase().replace(/\s+/g, " ").trim();

  // Hardcoded covers take priority over the cache (overrides any cached null).
  // Values may be a single URL string or an array of URLs tried in order.
  const titleKey = title.toLowerCase().replace(/\s+/g, " ").trim();
  const hardcoded = HARDCODED_COVERS[titleKey];
  if (hardcoded) {
    const candidates = Array.isArray(hardcoded) ? hardcoded : [hardcoded];
    for (const candidate of candidates) {
      const loaded = await probeImage(candidate);
      if (loaded) {
        coverCacheSet(key, candidate);
        return candidate;
      }
    }
  }

  const cached = coverCacheGet(key);
  if (cached !== undefined) return cached;

  // 1. Open Library with title + author
  // 2. Google Books with title + author
  // 3. Open Library with title only (catches books where author spelling differs)
  const url = (await fetchFromOpenLibrary(title, author)) ||
              (await fetchFromGoogleBooks(title, author)) ||
              (await fetchFromOpenLibrary(title, "")) || null;

  coverCacheSet(key, url);
  return url;
}

function applycover(area, url, altText) {
  const img = new Image();
  img.onload = () => {
    area.innerHTML = "";
    img.className = area.classList.contains("rec-cover-wrap") ? "rec-cover" : "book-cover-img";
    img.alt = altText || "";
    area.appendChild(img);
  };
  // onerror: leave placeholder in place
  img.src = url;
}

async function loadBookCovers() {
  const areas = Array.from(document.querySelectorAll(".book-cover-area[data-cover-title]"));
  // Process in batches of 3 to avoid overwhelming the APIs
  for (let i = 0; i < areas.length; i += 3) {
    await Promise.all(
      areas.slice(i, i + 3).map(async (area) => {
        const url = await fetchBookCover(area.dataset.coverTitle, area.dataset.coverAuthor);
        if (url) applycover(area, url, area.dataset.coverTitle);
      })
    );
  }
}

function amazonUrl(title, author) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(title + " " + author)}`;
}

async function renderRecCard(container, data) {
  if (data.error) {
    container.innerHTML = `<p class="text-muted fst-italic mb-0">${escapeHtml(data.error)}</p>`;
    return;
  }
  const title = data.title || "";
  const author = data.author || "";
  const reason = data.reason || "";
  const coverId = `rc-${Math.random().toString(36).slice(2)}`;

  container.innerHTML = `
    <div class="rec-card">
      <div class="rec-cover-wrap" id="${coverId}">
        <div class="rec-cover-placeholder">📖</div>
      </div>
      <div class="rec-card-body">
        <div class="rec-card-title">${escapeHtml(title)}</div>
        <div class="rec-card-author">by ${escapeHtml(author)}</div>
        <p class="rec-card-reason">${escapeHtml(reason)}</p>
        <a href="${amazonUrl(title, author)}" target="_blank" rel="noopener" class="btn-amazon">Buy on Amazon</a>
      </div>
    </div>`;

  const coverUrl = await fetchBookCover(title, author);
  const wrap = document.getElementById(coverId);
  if (coverUrl && wrap) applycover(wrap, coverUrl, title);
}

async function loadGroupRec(bookId) {
  const body = document.getElementById("groupRecBody");
  if (!body) return;
  body.innerHTML = `<div class="rec-spinner"><div class="spinner-border spinner-border-sm"></div> Generating recommendation…</div>`;
  try {
    const res = await fetch(`/books/${bookId}/recommend`);
    await renderRecCard(body, await res.json());
  } catch {
    body.innerHTML = `<p class="text-danger mb-0">Failed to load recommendation. Check your API key.</p>`;
  }
}

async function loadMeetingSummary(bookId) {
  const body = document.getElementById("meetingSummaryBody");
  if (!body) return;
  body.innerHTML = `<div class="rec-spinner"><div class="spinner-border spinner-border-sm"></div> Generating discussion summary…</div>`;
  try {
    const res = await fetch(`/books/${bookId}/meeting-summary`);
    const data = await res.json();
    if (data.error) {
      body.innerHTML = `<p class="text-muted fst-italic mb-0">${escapeHtml(data.error)}</p>`;
    } else {
      body.innerHTML = `<p class="rec-text mb-0">${escapeHtml(data.summary)}</p>`;
    }
  } catch {
    body.innerHTML = `<p class="text-danger mb-0">Failed to generate summary. Check your API key.</p>`;
  }
}

async function loadMemberRec(memberId) {
  const body = document.getElementById("memberRecBody");
  if (!body) return;
  body.innerHTML = `<div class="rec-spinner"><div class="spinner-border spinner-border-sm"></div> Generating personalised recommendation…</div>`;
  try {
    const res = await fetch(`/members/${memberId}/recommend`);
    await renderRecCard(body, await res.json());
  } catch {
    body.innerHTML = `<p class="text-danger mb-0">Failed to load recommendation. Check your API key.</p>`;
  }
}

async function loadClubRec() {
  const body = document.getElementById("clubRecBody");
  if (!body) return;
  body.innerHTML = `<div class="rec-spinner"><div class="spinner-border spinner-border-sm"></div> Finding your next book…</div>`;
  try {
    const res = await fetch("/club/recommend");
    await renderRecCard(body, await res.json());
  } catch {
    body.innerHTML = `<p class="text-danger mb-0">Failed to load recommendation. Check your API key.</p>`;
  }
}

async function loadMemberPersonality(memberId) {
  const body = document.getElementById("memberPersonalityBody");
  if (!body) return;

  try {
    const res = await fetch(`/members/${memberId}/personality`);
    const data = await res.json();
    body.innerHTML = `<p class="rec-text mb-0">${escapeHtml(data.personality)}</p>`;
  } catch {
    body.innerHTML = `<p class="text-danger mb-0">Failed to load personality. Check your API key.</p>`;
  }
}

async function loadGroupPersonality() {
  const body = document.getElementById("clubPersonalityBody");
  if (!body) return;

  try {
    const res = await fetch(`/club/personality`);
    const data = await res.json();
    body.innerHTML = `<p class="rec-text mb-0">${escapeHtml(data.personality)}</p>`;
  } catch {
    body.innerHTML = `<p class="text-danger mb-0">Failed to load club personality. Check your API key.</p>`;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

// ── Nomination Suggester ───────────────────────────────────────────────

async function loadNominationSuggestions(theme) {
  const results = document.getElementById("nominationResults");
  const btn = document.getElementById("nominationBtn");
  if (!results) return;

  results.innerHTML = `<div class="rec-spinner"><div class="spinner-border spinner-border-sm"></div> Generating suggestions for "${escapeHtml(theme)}"…</div>`;
  btn.disabled = true;

  try {
    const res = await fetch(`/club/suggest-nominations?theme=${encodeURIComponent(theme)}`);
    const data = await res.json();

    if (data.error) {
      results.innerHTML = `<p class="text-danger mb-0">${escapeHtml(data.error)}</p>`;
      return;
    }

    results.innerHTML = `<div class="row g-3" id="nominationCards"></div>`;
    const row = document.getElementById("nominationCards");

    await Promise.all(data.map(async (item, i) => {
      const col = document.createElement("div");
      col.className = "col-md-4";
      const coverId = `nc-${i}-${Math.random().toString(36).slice(2)}`;
      const stars = Math.round(item.predicted_rating);
      const starsHtml = Array.from({length: 5}, (_, i) =>
        `<span class="star ${i < stars ? "filled" : ""}">★</span>`
      ).join("");

      col.innerHTML = `
        <div class="card h-100">
          <div class="rec-cover-wrap" id="${coverId}">
            <div class="rec-cover-placeholder">📖</div>
          </div>
          <div class="card-body d-flex flex-column">
            <div class="rec-card-title">${escapeHtml(item.title)}</div>
            <div class="rec-card-author mb-2">by ${escapeHtml(item.author)}</div>
            <div class="d-flex align-items-center gap-2 mb-2">
              <div class="stars">${starsHtml}</div>
              <span class="fw-bold" style="font-family:'Playfair Display',serif">${item.predicted_rating.toFixed(1)}</span>
              <span class="gonder-label">predicted</span>
            </div>
            <p class="small text-muted mb-2 flex-grow-1">${escapeHtml(item.reason)}</p>
            <a href="${amazonUrl(item.title, item.author)}" target="_blank" rel="noopener" class="btn-amazon mt-auto">Buy on Amazon</a>
          </div>
        </div>`;
      row.appendChild(col);

      const coverUrl = await fetchBookCover(item.title, item.author);
      const wrap = document.getElementById(coverId);
      if (coverUrl && wrap) applycover(wrap, coverUrl, item.title);
    }));
  } catch {
    results.innerHTML = `<p class="text-danger mb-0">Failed to get suggestions. Check your API key.</p>`;
  } finally {
    btn.disabled = false;
  }
}
