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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img.restaurant-logo, img.restaurant-logo-lg').forEach(img => {
    const name = img.dataset.restaurant;
    if (!name) return;

    const lower = name.toLowerCase().trim();
    const knownDomain = RESTAURANT_DOMAINS[lower];
    const inferredDomain = lower.replace(/[^a-z0-9]/g, '') + '.com';
    const domain = knownDomain || inferredDomain;

    img.src = `https://logo.clearbit.com/${domain}`;
    img.style.display = 'inline-block';
    img.onerror = () => {
      fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.length > 0 && data[0].logo) {
            img.onerror = () => { img.style.display = 'none'; };
            img.src = data[0].logo;
          } else {
            img.style.display = 'none';
          }
        })
        .catch(() => { img.style.display = 'none'; });
    };
  });
});
