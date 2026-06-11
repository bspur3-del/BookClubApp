document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img.restaurant-logo, img.restaurant-logo-lg').forEach(img => {
    const name = img.dataset.restaurant;
    if (!name) return;
    fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0 && data[0].logo) {
          img.src = data[0].logo;
          img.style.display = 'inline-block';
          img.onerror = () => { img.style.display = 'none'; };
        }
      })
      .catch(() => {});
  });
});
