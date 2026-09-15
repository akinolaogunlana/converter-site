const fs = require('fs');
const path = require('path');
const { convertValue, formatNum } = require('./lib/conversion-core.js');

const SITE_NAME = 'Convertly'; // CHANGE ME before you launch
const SITE_URL = 'https://example.com'; // CHANGE ME - your real domain, no trailing slash
const OUT = path.join(__dirname, 'dist');
const units = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/units.json'), 'utf8'));
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// Font files this build self-hosts (copied from node_modules @fontsource packages).
// No Google Fonts request at runtime — faster first paint, zero third-party dependency.
const FONT_FILES = [
  ['@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['@fontsource/inter/files/inter-latin-500-normal.woff2', 'inter-500.woff2'],
  ['@fontsource/inter/files/inter-latin-600-normal.woff2', 'inter-600.woff2'],
  ['@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2', 'space-grotesk-500.woff2'],
  ['@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2', 'space-grotesk-600.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 'jbmono-400.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2', 'jbmono-500.woff2']
];

function slugify(s) { return s.replace(/_/g, '-'); }
function titleCase(s) { return s.replace(/_/g, ' '); }

function head(title, description, canonical, jsonLd) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>`;
}

function breadcrumbLd(items) {
  // items: [{name, url}, ...]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url
    }))
  };
}

function header(crumbs) {
  return `<header class="site"><div class="wrap">
  <a class="wordmark" href="/">${SITE_NAME}<span class="dot">.</span></a>
  <nav class="crumbs">${crumbs}</nav>
</div></header>`;
}

function footer() {
  return `<footer class="site"><div class="wrap">
  Free unit conversions, generated from live data. No signup, no tracking beyond what keeps the lights on.
</div></footer>`;
}

function adSlot(label) {
  return `<div class="ad-slot">[ ${label} — drop your AdSense / Carbon Ads / EthicalAds unit here ]</div>`;
}

function pageWrap(bodyHtml) {
  return `${bodyHtml}
<script src="/assets/conversion-core.js"></script>
<script src="/assets/converter.js"></script>
</body></html>`;
}

// ---------- Homepage ----------
function buildHome() {
  const cats = Object.entries(units).map(([key, cat]) => {
    const n = Object.keys(cat.units).length;
    const pairCount = n * (n - 1);
    return `<a href="/${slugify(key)}/"><div class="cat-name">${cat.label}</div><div class="cat-count">${pairCount} conversions</div></a>`;
  }).join('\n');

  const html = head(
    `${SITE_NAME} — Free unit converters`,
    `Fast, free unit conversion tools for length, weight, volume, temperature, digital storage, time, speed and area.`,
    `${SITE_URL}/`,
    breadcrumbLd([{ name: 'Home', url: `${SITE_URL}/` }])
  ) + `
${header('')}
<main class="wrap">
  <h1>Convert anything. Instantly.</h1>
  <p class="subhead">No ads blocking the number you came for, no account, no watching a spinner. Pick a category, pick your units, done.</p>
  <div class="category-grid">
  ${cats}
  </div>
  ${adSlot('homepage banner')}
</main>
${footer()}`;
  write('index.html', pageWrap(html));
}

// ---------- Category index ----------
function buildCategory(key, cat) {
  const dir = path.join(OUT, slugify(key));
  fs.mkdirSync(dir, { recursive: true });

  const rows = Object.entries(cat.units).map(([uKey, u]) =>
    `<tr><td>${u.label}</td><td>${u.symbol}</td></tr>`
  ).join('\n');

  const links = [];
  for (const fromKey of Object.keys(cat.units)) {
    for (const toKey of Object.keys(cat.units)) {
      if (fromKey === toKey) continue;
      links.push(`<a href="/${slugify(key)}/${slugify(fromKey)}-to-${slugify(toKey)}/">${cat.units[fromKey].symbol} → ${cat.units[toKey].symbol}</a>`);
    }
  }

  const html = head(
    `${cat.label} Converter — ${SITE_NAME}`,
    `Convert between every ${cat.label.toLowerCase()} unit: ${Object.values(cat.units).map(u => u.label).join(', ')}.`,
    `${SITE_URL}/${slugify(key)}/`,
    breadcrumbLd([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: cat.label, url: `${SITE_URL}/${slugify(key)}/` }
    ])
  ) + `
${header(`<a href="/">Home</a> / ${cat.label}`)}
<main class="wrap">
  <h1>${cat.label} converter</h1>
  <p class="subhead">Every unit, every combination, calculated instantly in your browser.</p>
  <table class="unit-table">
    <tr><th>Unit</th><th>Symbol</th></tr>
    ${rows}
  </table>
  ${adSlot('category page banner')}
  <div class="related">
    <h2>All ${cat.label.toLowerCase()} conversions</h2>
    <div class="pill-list">${links.join('\n')}</div>
  </div>
</main>
${footer()}`;
  write(path.join(slugify(key), 'index.html'), pageWrap(html));
}

// ---------- Individual conversion page ----------
const COMMON_VALUES = [1, 5, 10, 25, 50, 100];

function buildConversionPage(key, cat, fromKey, toKey) {
  const from = cat.units[fromKey];
  const to = cat.units[toKey];
  const dir = path.join(OUT, slugify(key), `${slugify(fromKey)}-to-${slugify(toKey)}`);
  fs.mkdirSync(dir, { recursive: true });

  const specialType = cat.special || null;
  const fromFactor = specialType ? '' : from.toBase;
  const toFactor = specialType ? '' : to.toBase;
  const swapUrl = `/${slugify(key)}/${slugify(toKey)}-to-${slugify(fromKey)}/`;

  // related: same category, different pairs (sample a handful for internal linking)
  const others = Object.keys(cat.units).filter(k => k !== fromKey && k !== toKey).slice(0, 6);
  const relatedLinks = others.map(k =>
    `<a href="/${slugify(key)}/${slugify(fromKey)}-to-${slugify(k)}/">${from.symbol} → ${cat.units[k].symbol}</a>`
  ).join('\n');

  const title = `Convert ${from.label} to ${to.label} — ${SITE_NAME}`;
  const desc = `Free ${from.label.toLowerCase()} to ${to.label.toLowerCase()} converter. Enter a value and get an instant, accurate result.`;
  const canonical = `${SITE_URL}/${slugify(key)}/${slugify(fromKey)}-to-${slugify(toKey)}/`;

  // Unique per-page content: precomputed quick-reference table (real content, not filler)
  const quickRows = COMMON_VALUES.map(v => {
    const result = convertValue(v, { specialType, fromKey, toKey, fromFactor: from.toBase, toFactor: to.toBase });
    return `<tr><td>${v} ${from.symbol}</td><td>${formatNum(result)} ${to.symbol}</td></tr>`;
  }).join('\n');

  // Unique comparison sentence — genuinely differentiates near-mirror pages (X-to-Y vs Y-to-X)
  let contextSentence;
  if (specialType === 'temperature') {
    contextSentence = `${from.label} and ${to.label} are both temperature scales; the conversion uses an offset, not a simple multiplier.`;
  } else if (specialType === 'fuel_economy') {
    contextSentence = `${from.label} and ${to.label} measure fuel economy on different scales — one of these is inverted (lower is better), so this isn't a straight-line conversion.`;
  } else {
    const ratio = from.toBase / to.toBase;
    contextSentence = ratio >= 1
      ? `One ${from.label.toLowerCase().replace(/s$/, '')} equals ${formatNum(ratio)} ${to.label.toLowerCase()} — a single ${from.symbol} is larger than a single ${to.symbol}.`
      : `One ${from.label.toLowerCase().replace(/s$/, '')} equals ${formatNum(ratio)} ${to.label.toLowerCase()} — it takes many ${to.symbol} to make one ${from.symbol}.`;
  }

  const jsonLd = [
    breadcrumbLd([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: cat.label, url: `${SITE_URL}/${slugify(key)}/` },
      { name: `${from.label} to ${to.label}`, url: canonical }
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: `${from.label} to ${to.label} Converter`,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
    }
  ];

  const html = head(title, desc, canonical, jsonLd) + `
${header(`<a href="/">Home</a> / <a href="/${slugify(key)}/">${cat.label}</a> / ${from.label} to ${to.label}`)}
<main class="wrap">
  <h1>${from.label} to ${to.label}</h1>
  <p class="subhead">${contextSentence}</p>

  <div class="converter" data-converter
       data-from-factor="${fromFactor}" data-to-factor="${toFactor}"
       data-from-unit="${fromKey}" data-to-unit="${toKey}"
       data-special="${specialType || ''}" data-swap-url="${swapUrl}">
    <div class="field-row">
      <div class="field">
        <label for="in">${from.label} (${from.symbol})</label>
        <input id="in" data-role="input" type="number" value="1" inputmode="decimal">
      </div>
      <button class="swap-btn" data-role="swap" title="Swap units" aria-label="Swap ${from.label} and ${to.label}">⇄</button>
      <div class="field">
        <label for="out">${to.label} (${to.symbol})</label>
        <input id="out" data-role="output" type="text" readonly aria-live="polite">
      </div>
    </div>
    ${specialType ? '' : `<p class="factor-note">1 ${from.symbol} = ${(from.toBase / to.toBase).toPrecision(6)} ${to.symbol}</p>`}
  </div>

  ${adSlot('in-content unit')}

  <noscript>
    <table class="unit-table">
      <tr><th>${from.label}</th><th>${to.label}</th></tr>
      ${quickRows}
    </table>
  </noscript>

  <div class="related">
    <h2>Common ${from.label.toLowerCase()} values</h2>
    <table class="unit-table">
      <tr><th>${from.label}</th><th>${to.label}</th></tr>
      ${quickRows}
    </table>
  </div>

  <div class="related">
    <h2>More from ${from.label.toLowerCase()}</h2>
    <div class="pill-list">${relatedLinks}</div>
  </div>
</main>
${footer()}`;
  write(path.join(slugify(key), `${slugify(fromKey)}-to-${slugify(toKey)}`, 'index.html'), pageWrap(html));
}

function write(relPath, content) {
  const full = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// ---------- Sitemap ----------
function buildSitemap(allUrls) {
  const urls = allUrls.map(u => `  <url><loc>${u}</loc><lastmod>${BUILD_DATE}</lastmod></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  write('sitemap.xml', xml);
}

function buildRobots() {
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

// ---------- 404 ----------
function build404() {
  const html = head(
    `Page not found — ${SITE_NAME}`,
    `That conversion page doesn't exist.`,
    `${SITE_URL}/404.html`
  ) + `
${header('')}
<main class="wrap">
  <h1>Page not found</h1>
  <p class="subhead">That conversion doesn't exist yet. Try the <a href="/">homepage</a> to find the right category.</p>
</main>
${footer()}`;
  write('404.html', pageWrap(html));
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#1A2333"/><text x="16" y="22" font-family="monospace" font-size="16" fill="#D2661A" text-anchor="middle">⇄</text></svg>`;

// ---------- Run ----------
function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(OUT, 'assets', 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'assets/style.css'), path.join(OUT, 'assets/style.css'));
  fs.copyFileSync(path.join(__dirname, 'assets/converter.js'), path.join(OUT, 'assets/converter.js'));
  fs.copyFileSync(path.join(__dirname, 'lib/conversion-core.js'), path.join(OUT, 'assets/conversion-core.js'));
  fs.writeFileSync(path.join(OUT, 'assets/favicon.svg'), FAVICON_SVG);

  for (const [src, destName] of FONT_FILES) {
    const srcPath = path.join(__dirname, 'node_modules', src);
    fs.copyFileSync(srcPath, path.join(OUT, 'assets/fonts', destName));
  }

  const allUrls = [`${SITE_URL}/`];
  buildHome();
  build404();

  let pageCount = 1;
  for (const [key, cat] of Object.entries(units)) {
    buildCategory(key, cat);
    allUrls.push(`${SITE_URL}/${slugify(key)}/`);
    pageCount++;
    for (const fromKey of Object.keys(cat.units)) {
      for (const toKey of Object.keys(cat.units)) {
        if (fromKey === toKey) continue;
        buildConversionPage(key, cat, fromKey, toKey);
        allUrls.push(`${SITE_URL}/${slugify(key)}/${slugify(fromKey)}-to-${slugify(toKey)}/`);
        pageCount++;
      }
    }
  }

  buildSitemap(allUrls);
  buildRobots();

  console.log(`Generated ${pageCount} pages into /dist`);
}

main();
