# Convertly — free programmatic unit converter site

A static site generator that turns one dataset (`data/units.json`) into hundreds
of standalone, fully-functional unit conversion pages — no backend, no
database, no paid API, no build framework. Currently generates **618 pages**
across 15 categories (length, weight, volume, digital storage, time, speed,
area, pressure, energy, power, angle, force, data transfer rate, temperature,
fuel economy).

## Why this exists

Programmatic SEO: one template + one dataset → many independently-rankable
pages, each with a genuinely working tool (not just swapped text), each
ad-slot-ready. See `data/units.json` to understand the whole site's content.

## Quick start

```bash
npm install      # pulls in self-hosted font packages (@fontsource/*)
npm run build    # runs generate.js, writes the full site to /dist
```

Preview locally:

```bash
cd dist && python3 -m http.server 8000
# open http://localhost:8000
```

## Project structure

```
data/units.json        — the single source of truth for every unit & category
lib/conversion-core.js — shared conversion math (used by generate.js AND the browser)
assets/style.css        — site styles (self-hosted fonts via @font-face)
assets/converter.js     — browser-side interactivity, calls conversion-core.js
generate.js             — the static site generator; produces /dist
dist/                    — build output (git-ignored, regenerate any time)
```

## Extending the site

To add more pages, edit `data/units.json`:
- Add a new unit to an existing category → every new from/to pair generates automatically.
- Add a new category → give it a `base` unit and a `units` object. For a
  non-linear relationship (like temperature or fuel economy), add
  `"special": "your_type_name"` and implement the math in
  `lib/conversion-core.js`'s `convertValue()`. That one function is used by
  both the generator and the browser, so there's only one place to get it right.

Then re-run `npm run build`.

## Before you deploy

Open `generate.js` and change these two constants at the top:

```js
const SITE_NAME = 'Convertly';           // your real site name
const SITE_URL = 'https://example.com';  // your real domain, no trailing slash
```

## Deploying

**GitHub Pages (free, automatic):** this repo ships with
`.github/workflows/deploy.yml`. Push to `main`, then in your repo go to
**Settings → Pages → Source → GitHub Actions**. Every push rebuilds and
redeploys automatically.

**Cloudflare Pages / Vercel / Netlify (also free):** connect the repo, set
build command to `npm run build`, output directory to `dist`.

## Turning on ads

Every page has clearly marked `.ad-slot` divs. Once you have real traffic,
apply to Google AdSense, Carbon Ads, or EthicalAds, then paste your ad unit
snippet into the `adSlot()` function in `generate.js` and rebuild.

## License

MIT — see LICENSE.
