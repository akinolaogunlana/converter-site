(function () {
  const input = document.getElementById('site-search');
  const resultsBox = document.getElementById('search-results');
  if (!input || !resultsBox) return;

  let index = null;

  fetch('/assets/search-index.json')
    .then(r => r.json())
    .then(data => { index = data; })
    .catch(() => { index = []; });

  function render(matches) {
    if (!matches.length) {
      resultsBox.hidden = true;
      resultsBox.innerHTML = '';
      return;
    }
    resultsBox.innerHTML = matches.slice(0, 8).map(m =>
      `<a href="${m.u}">${m.t}</a>`
    ).join('');
    resultsBox.hidden = false;
  }

  input.addEventListener('input', function () {
    const q = input.value.trim().toLowerCase();
    if (!q || !index) { render([]); return; }
    const matches = index.filter(entry =>
      entry.t.toLowerCase().includes(q) || entry.s.toLowerCase().includes(q)
    );
    render(matches);
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-box')) render([]);
  });
})();
