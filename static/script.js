document.addEventListener("DOMContentLoaded", () => {
  initStarPickers();

  const bookId = document.body.dataset.bookId;
  const memberId = document.body.dataset.memberId;

  if (bookId) loadGroupRec(bookId);
  if (memberId) loadMemberRec(memberId);
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

async function loadGroupRec(bookId) {
  const body = document.getElementById("groupRecBody");
  if (!body) return;
  body.innerHTML = `<div class="rec-spinner"><div class="spinner-border spinner-border-sm"></div> Generating recommendation…</div>`;

  try {
    const res = await fetch(`/books/${bookId}/recommend`);
    const data = await res.json();
    body.innerHTML = `<p class="rec-text mb-0">${escapeHtml(data.recommendation)}</p>`;
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
    const data = await res.json();
    body.innerHTML = `<p class="rec-text mb-0">${escapeHtml(data.recommendation)}</p>`;
  } catch {
    body.innerHTML = `<p class="text-danger mb-0">Failed to load recommendation. Check your API key.</p>`;
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
