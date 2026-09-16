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

// Singularizes only the FIRST word of a label ("Minutes per Kilometer" -> "minute per
// kilometer"), not the whole string — a naive trailing-s strip breaks on any multi-word
// label where the plural word isn't last (e.g. "Meters per Second").
function singularizeLabel(label) {
  const words = label.toLowerCase().split(' ');
  words[0] = words[0].replace(/s$/, '');
  return words.join(' ');
}

// Special conversion types actually implemented in lib/conversion-core.js.
// If units.json references a special type not in this list, the build fails
// loudly instead of silently generating NaN on every affected page.
const SUPPORTED_SPECIAL_TYPES = ['temperature', 'fuel_economy', 'pace'];

function head(title, description, canonical, jsonLdList) {
  const items = jsonLdList ? (Array.isArray(jsonLdList) ? jsonLdList : [jsonLdList]) : [];
  const jsonLdTags = items.map(obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`).join('\n');
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
${jsonLdTags}
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

// Keeps <title> tags from getting truncated in search results (~60 char safe zone).
// Drops the branding suffix on long unit-name combinations rather than truncating
// the actual conversion name, which would be confusing.
function buildTitle(base) {
  const withSuffix = `${base} — ${SITE_NAME}`;
  return withSuffix.length <= 60 ? withSuffix : base;
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

  <div class="search-box">
    <input type="text" id="site-search" placeholder="Search a conversion — e.g. km to miles, celsius to fahrenheit" aria-label="Search conversions" autocomplete="off">
    <div id="search-results" class="search-results" hidden></div>
  </div>

  <div class="category-grid">
  ${cats}
  </div>
  ${adSlot('homepage banner')}
</main>
${footer()}
<script src="/assets/search.js"></script>`;
  write('index.html', pageWrap(html));
}

// ---------- Search index (client-side only, no API) ----------
function buildSearchIndex(entries) {
  write('assets/search-index.json', JSON.stringify(entries));
}

// ---------- Category index ----------
function buildCategory(key, cat) {
  const dir = path.join(OUT, slugify(key));
  fs.mkdirSync(dir, { recursive: true });

  const rows = Object.entries(cat.units).map(([uKey, u]) =>
    `<tr><td>${u.label}</td><td>${u.symbol}</td></tr>`
  ).join('\n');

  // Grouped by source unit (not one flat pile of every pair) — stays organized
  // even for categories with many units, per internal-linking guidance.
  const groups = Object.keys(cat.units).map(fromKey => {
    const from = cat.units[fromKey];
    const targets = Object.keys(cat.units).filter(k => k !== fromKey);
    const links = targets.map(toKey =>
      `<a href="/${slugify(key)}/${slugify(fromKey)}-to-${slugify(toKey)}/">${from.symbol} → ${cat.units[toKey].symbol}</a>`
    ).join('\n');
    return `<div class="link-group"><h3>${from.label}</h3><div class="pill-list">${links}</div></div>`;
  }).join('\n');

  // ItemList schema describing the visible conversion links on this page (accurate, not inflated)
  const allPairs = [];
  for (const fromKey of Object.keys(cat.units)) {
    for (const toKey of Object.keys(cat.units)) {
      if (fromKey === toKey) continue;
      allPairs.push({ fromKey, toKey });
    }
  }
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: allPairs.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/${slugify(key)}/${slugify(p.fromKey)}-to-${slugify(p.toKey)}/`,
      name: `${cat.units[p.fromKey].label} to ${cat.units[p.toKey].label}`
    }))
  };

  const html = head(
    `${cat.label} Converter — ${SITE_NAME}`,
    `Convert between every ${cat.label.toLowerCase()} unit: ${Object.values(cat.units).map(u => u.label).join(', ')}.`,
    `${SITE_URL}/${slugify(key)}/`,
    [
      breadcrumbLd([
        { name: 'Home', url: `${SITE_URL}/` },
        { name: cat.label, url: `${SITE_URL}/${slugify(key)}/` }
      ]),
      itemListLd
    ]
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
    ${groups}
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

  const title = buildTitle(`Convert ${from.label} to ${to.label}`);
  const canonical = `${SITE_URL}/${slugify(key)}/${slugify(fromKey)}-to-${slugify(toKey)}/`;

  // Unique per-page content: precomputed quick-reference table (real content, not filler)
  const quickRows = COMMON_VALUES.map(v => {
    const result = convertValue(v, { specialType, fromKey, toKey, fromFactor: from.toBase, toFactor: to.toBase });
    return `<tr><td>${v} ${from.symbol}</td><td>${formatNum(result)} ${to.symbol}</td></tr>`;
  }).join('\n');

  const oneUnitResult = formatNum(convertValue(1, { specialType, fromKey, toKey, fromFactor: from.toBase, toFactor: to.toBase }));

  // Unique comparison sentence — genuinely differentiates near-mirror pages (X-to-Y vs Y-to-X)
  let contextSentence, howToAnswer, howManyAnswer, desc;
  if (specialType === 'temperature') {
    contextSentence = `${from.label} and ${to.label} are both temperature scales; the conversion uses an offset, not a simple multiplier.`;
    howToAnswer = specialType === 'temperature'
      ? (fromKey === 'celsius' && toKey === 'fahrenheit' ? 'Multiply by 9/5, then add 32.'
        : fromKey === 'fahrenheit' && toKey === 'celsius' ? 'Subtract 32, then multiply by 5/9.'
        : fromKey === 'celsius' && toKey === 'kelvin' ? 'Add 273.15.'
        : fromKey === 'kelvin' && toKey === 'celsius' ? 'Subtract 273.15.'
        : `Convert through Celsius as an intermediate step.`)
      : '';
    howManyAnswer = `1 ${from.symbol} equals ${oneUnitResult} ${to.symbol}.`;
    desc = `How to convert ${from.label.toLowerCase()} to ${to.label.toLowerCase()}: ${howToAnswer} Free instant calculator, no signup.`;
  } else if (specialType === 'fuel_economy') {
    contextSentence = `${from.label} and ${to.label} measure fuel economy on different scales — one of these is inverted (lower is better), so this isn't a straight-line conversion.`;
    howToAnswer = `${from.label} and ${to.label} aren't linearly related — one measures distance per fuel unit, the other fuel per distance. This calculator handles the inversion for you.`;
    howManyAnswer = `1 ${from.symbol} equals ${oneUnitResult} ${to.symbol}.`;
    desc = `Convert ${from.label.toLowerCase()} to ${to.label.toLowerCase()} correctly, including the inverse relationship. Free instant calculator.`;
  } else if (specialType === 'pace') {
    contextSentence = `${from.label} and ${to.label} aren't a straight multiplier apart — pace (time per distance) and speed (distance per time) are inverses of each other.`;
    howToAnswer = `${from.label} and ${to.label} are inverse measurements — one gets smaller as you go faster, the other gets larger. This calculator converts through speed to handle that correctly.`;
    howManyAnswer = `1 ${from.symbol} equals ${oneUnitResult} ${to.symbol}.`;
    desc = `Convert ${from.label.toLowerCase()} to ${to.label.toLowerCase()} for running or cycling, inverse relationship handled correctly. Free calculator.`;
  } else {
    const ratio = from.toBase / to.toBase;
    contextSentence = ratio >= 1
      ? `One ${singularizeLabel(from.label)} equals ${formatNum(ratio)} ${to.label.toLowerCase()} — a single ${from.symbol} is larger than a single ${to.symbol}.`
      : `One ${singularizeLabel(from.label)} equals ${formatNum(ratio)} ${to.label.toLowerCase()} — it takes many ${to.symbol} to make one ${from.symbol}.`;
    howToAnswer = `Multiply the ${from.label.toLowerCase()} value by ${formatNum(ratio)} to get ${to.label.toLowerCase()}.`;
    howManyAnswer = `1 ${from.symbol} equals ${oneUnitResult} ${to.symbol}.`;
    desc = `1 ${from.symbol} = ${formatNum(ratio)} ${to.symbol}. Convert ${from.label.toLowerCase()} to ${to.label.toLowerCase()} instantly with a free live calculator.`;
  }
  if (cat.note) contextSentence += ` ${cat.note}`;

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
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `How do you convert ${from.label.toLowerCase()} to ${to.label.toLowerCase()}?`,
          acceptedAnswer: { '@type': 'Answer', text: howToAnswer }
        },
        {
          '@type': 'Question',
          name: `How many ${to.label.toLowerCase()} are in 1 ${singularizeLabel(from.label)}?`,
          acceptedAnswer: { '@type': 'Answer', text: howManyAnswer }
        }
      ]
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
    <button class="reset-btn" data-role="reset" type="button">Reset</button>
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

  <div class="faq">
    <h2>Frequently asked</h2>
    <div class="faq-item">
      <h3>How do you convert ${from.label.toLowerCase()} to ${to.label.toLowerCase()}?</h3>
      <p>${howToAnswer}</p>
    </div>
    <div class="faq-item">
      <h3>How many ${to.label.toLowerCase()} are in 1 ${singularizeLabel(from.label)}?</h3>
      <p>${howManyAnswer}</p>
    </div>
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
  ).replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex, follow">') + `
${header('')}
<main class="wrap">
  <h1>Page not found</h1>
  <p class="subhead">That conversion doesn't exist yet. Try the <a href="/">homepage</a> to find the right category.</p>
</main>
${footer()}`;
  write('404.html', pageWrap(html));
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#1A2333"/><text x="16" y="22" font-family="monospace" font-size="16" fill="#D2661A" text-anchor="middle">⇄</text></svg>`;

// ---------- Validation (build must fail loudly on bad data, never generate silently-broken pages) ----------
function validateData() {
  const errors = [];
  const seenCategorySlugs = new Set();

  for (const [key, cat] of Object.entries(units)) {
    const catSlug = slugify(key);
    if (seenCategorySlugs.has(catSlug)) errors.push(`Duplicate category URL slug: "${catSlug}" (from category key "${key}")`);
    seenCategorySlugs.add(catSlug);

    if (!cat.label) errors.push(`Category "${key}" is missing "label"`);
    if (!cat.units || Object.keys(cat.units).length < 2) errors.push(`Category "${key}" needs at least 2 units`);
    if (cat.special && !SUPPORTED_SPECIAL_TYPES.includes(cat.special)) {
      errors.push(`Category "${key}" has special type "${cat.special}" with no implementation in lib/conversion-core.js. Supported: ${SUPPORTED_SPECIAL_TYPES.join(', ')}`);
    }

    const seenUnitSlugs = new Set();
    for (const [uKey, u] of Object.entries(cat.units || {})) {
      const uSlug = slugify(uKey);
      if (seenUnitSlugs.has(uSlug)) errors.push(`Category "${key}": duplicate unit URL slug "${uSlug}" (from unit key "${uKey}")`);
      seenUnitSlugs.add(uSlug);

      if (!u.label) errors.push(`Category "${key}", unit "${uKey}" is missing "label"`);
      if (!u.symbol) errors.push(`Category "${key}", unit "${uKey}" is missing "symbol"`);
      if (!cat.special && typeof u.toBase !== 'number') {
        errors.push(`Category "${key}", unit "${uKey}" is missing a numeric "toBase" (required for non-special categories)`);
      }
    }
  }

  if (errors.length) {
    console.error(`\nBuild failed — ${errors.length} data problem(s) in data/units.json:\n`);
    errors.forEach(e => console.error(`  ✗ ${e}`));
    console.error('');
    process.exit(1);
  }
}

// ---------- Run ----------
function main() {
  validateData();

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(OUT, 'assets', 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'assets/style.css'), path.join(OUT, 'assets/style.css'));
  fs.copyFileSync(path.join(__dirname, 'assets/converter.js'), path.join(OUT, 'assets/converter.js'));
  fs.copyFileSync(path.join(__dirname, 'assets/search.js'), path.join(OUT, 'assets/search.js'));
  fs.copyFileSync(path.join(__dirname, 'lib/conversion-core.js'), path.join(OUT, 'assets/conversion-core.js'));
  fs.writeFileSync(path.join(OUT, 'assets/favicon.svg'), FAVICON_SVG);

  for (const [src, destName] of FONT_FILES) {
    const srcPath = path.join(__dirname, 'node_modules', src);
    fs.copyFileSync(srcPath, path.join(OUT, 'assets/fonts', destName));
  }

  const allUrls = [`${SITE_URL}/`];
  const searchEntries = [];
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
        const url = `/${slugify(key)}/${slugify(fromKey)}-to-${slugify(toKey)}/`;
        allUrls.push(`${SITE_URL}${url}`);
        searchEntries.push({
          t: `${cat.units[fromKey].label} to ${cat.units[toKey].label}`,
          s: `${cat.units[fromKey].symbol} ${cat.units[toKey].symbol}`,
          u: url
        });
        pageCount++;
      }
    }
  }

  buildSearchIndex(searchEntries);
  buildSitemap(allUrls);
  buildRobots();

  console.log(`Generated ${pageCount + 1} pages into /dist (${allUrls.length} indexable + 1 404 page)`);
}

main();
