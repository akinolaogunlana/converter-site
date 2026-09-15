(function () {
  function init(root) {
    const input = root.querySelector('[data-role="input"]');
    const output = root.querySelector('[data-role="output"]');
    const swapBtn = root.querySelector('[data-role="swap"]');
    const opts = {
      specialType: root.dataset.special || null,
      fromKey: root.dataset.fromUnit,
      toKey: root.dataset.toUnit,
      fromFactor: parseFloat(root.dataset.fromFactor),
      toFactor: parseFloat(root.dataset.toFactor)
    };

    function run() {
      const v = parseFloat(input.value);
      if (isNaN(v)) { output.value = ''; return; }
      output.value = window.ConversionCore.formatNum(
        window.ConversionCore.convertValue(v, opts)
      );
    }

    input.addEventListener('input', run);
    if (swapBtn) {
      swapBtn.addEventListener('click', function () {
        window.location.href = root.dataset.swapUrl;
      });
    }
    run();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-converter]').forEach(init);
  });
})();
