/**
 * Conversion core. Loaded two ways:
 *  - Node (`require`) during static site generation
 *  - Plain <script> tag in the browser for the live converter
 * Same function, same answer, every time. Fixing a bug here fixes it everywhere.
 */
(function (root) {
  const FUEL_FACTORS = {
    mpg_us: 0.4251437075,   // 1 mpg(US) = this many km/L
    mpg_uk: 0.35400619,     // 1 mpg(UK/imperial) = this many km/L
    km_per_liter: 1
    // l_per_100km handled as the inverse case below
  };

  function fuelToKmPerL(value, key) {
    if (key === 'l_per_100km') return value === 0 ? Infinity : 100 / value;
    return value * FUEL_FACTORS[key];
  }

  function fuelFromKmPerL(kml, key) {
    if (key === 'l_per_100km') return kml === 0 ? Infinity : 100 / kml;
    return kml / FUEL_FACTORS[key];
  }

  /**
   * @param {number} value
   * @param {object} opts - { specialType, fromKey, toKey, fromFactor, toFactor }
   *   specialType: null | 'temperature' | 'fuel_economy'
   *   fromFactor/toFactor: toBase multipliers (ignored when specialType is set)
   */
  function convertValue(value, opts) {
    const { specialType, fromKey, toKey, fromFactor, toFactor } = opts;

    if (specialType === 'temperature') {
      let c;
      if (fromKey === 'celsius') c = value;
      else if (fromKey === 'fahrenheit') c = (value - 32) * (5 / 9);
      else if (fromKey === 'kelvin') c = value - 273.15;
      if (toKey === 'celsius') return c;
      if (toKey === 'fahrenheit') return c * (9 / 5) + 32;
      if (toKey === 'kelvin') return c + 273.15;
    }

    if (specialType === 'fuel_economy') {
      const kml = fuelToKmPerL(value, fromKey);
      return fuelFromKmPerL(kml, toKey);
    }

    return value * (fromFactor / toFactor);
  }

  function formatNum(n) {
    if (!isFinite(n)) return '—';
    if (Math.abs(n) >= 1e9 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(4);
    return parseFloat(n.toFixed(6)).toString();
  }

  const api = { convertValue, formatNum };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ConversionCore = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
