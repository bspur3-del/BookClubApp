const RESTAURANT_DOMAINS = {
  "chick-fil-a": "chickfila.com",
  "chick fil a": "chickfila.com",
  "chickfila": "chickfila.com",
  "bojangles": "bojangles.com",
  "bojangles'": "bojangles.com",
  "mcdonald's": "mcdonalds.com",
  "mcdonalds": "mcdonalds.com",
  "popeyes": "popeyes.com",
  "popeye's": "popeyes.com",
  "kfc": "kfc.com",
  "hardee's": "hardees.com",
  "hardees": "hardees.com",
  "whataburger": "whataburger.com",
  "starbucks": "starbucks.com",
  "wendy's": "wendys.com",
  "wendys": "wendys.com",
  "burger king": "burgerking.com",
  "jack in the box": "jackinthebox.com",
  "sonic": "sonicdrivein.com",
  "biscuit love": "biscuitlove.com",
  "sunrise memphis": "sunrisememphis.com",
  "brother juniper's": "brotherjunipers.com",
  "brother junipers": "brotherjunipers.com",
  "first watch": "firstwatch.com",
  "cracker barrel": "crackerbarrel.com",
};

function loadLogo(img, sources) {
  if (!sources.length) { img.style.display = 'none'; return; }
  const [src, ...rest] = sources;
  img.onload  = () => { img.style.display = 'inline-block'; };
  img.onerror = () => loadLogo(img, rest);
  img.src = src;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img.restaurant-logo, img.restaurant-logo-md, img.restaurant-logo-lg').forEach(img => {
    const name = img.dataset.restaurant;
    if (!name) return;

    const lower = name.toLowerCase().trim();
    const domain = RESTAURANT_DOMAINS[lower] || (lower.replace(/[^a-z0-9]/g, '') + '.com');

    loadLogo(img, [
      `https://logo.clearbit.com/${domain}`,
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
    ]);
  });
});
