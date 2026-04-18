document.addEventListener("DOMContentLoaded", () => {
  initStarPickers();
  loadBookCovers();

  const bookId = document.body.dataset.bookId;
  const memberId = document.body.dataset.memberId;
  const clubPage = document.body.dataset.clubPage;

  if (bookId) loadGroupRec(bookId);
  if (memberId) loadMemberRec(memberId);
  if (memberId) loadMemberPersonality(memberId);
  if (clubPage) { loadGroupPersonality(); loadClubRec(); }
});

function initStarPickers() {
  document.querySelectorAll(".star-picker").forEach((picker) => {
    const stars = picker.querySelectorAll(".star-btn");
    const memberId = picker.dataset.member;
    const input = document.getElementById(`rating_${memberId}`);

    stars.forEach((star) => {
      star.addEventListener("mouseenter", () => highlight(stars, star.dataset.value));
      star.addEventListener("mouseleave", () => restoreActive(stars, input.value));
      star.addEventListener("click", () => {
        input.value = star.dataset.value;
        setActive(stars, star.dataset.value);
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

async function fetchBookCover(title, author) {
  // Try Google Books — simple combined query, check first few results
  try {
    const q = encodeURIComponent(`${title} ${author}`);
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5&printType=books`
    );
    const data = await res.json();
    if (data.items) {
      for (const item of data.items) {
        const links = item.volumeInfo && item.volumeInfo.imageLinks;
        if (links) {
          let url = links.thumbnail || links.smallThumbnail;
          if (url) {
            return url
              .replace(/^http:\/\//i, "https://")
              .replace("&edge=curl", "");
          }
        }
      }
    }
  } catch {}

  // Fallback: Open Library Covers API
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=3&fields=cover_i`
    );
    const data = await res.json();
    if (data.docs) {
      for (const doc of data.docs) {
        if (doc.cover_i) {
          return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
        }
      }
    }
  } catch {}

  return null;
}

async function loadBookCovers() {
  const areas = document.querySelectorAll(".book-cover-area[data-cover-title]");
  await Promise.all(Array.from(areas).map(async (area) => {
    const url = await fetchBookCover(area.dataset.coverTitle, area.dataset.coverAuthor);
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      area.innerHTML = "";
      area.appendChild(img);
      img.className = "book-cover-img";
      img.alt = area.dataset.coverTitle;
    };
    img.src = url;
  }));
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
  if (coverUrl && wrap) {
    const img = new Image();
    img.onload = () => {
      wrap.innerHTML = "";
      img.className = "rec-cover";
      img.alt = escapeHtml(title);
      wrap.appendChild(img);
    };
    img.src = coverUrl;
  }
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
