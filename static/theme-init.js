(function () {
  try {
    // Legacy turnwise key and old theme names are migrated until 2027-01.
    var theme = localStorage.getItem('wheelhq.theme') || localStorage.getItem('turnwise.theme');
    if (theme === 'corporate' || theme === 'light' || theme === 'winter' || theme === 'bumblebee') {
      theme = 'emerald';
    }
    if (theme === 'dark') theme = 'night';
    if (theme !== 'emerald' && theme !== 'night') {
      theme =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'night'
          : 'emerald';
    }
    document.documentElement.dataset.theme = theme;
  } catch {
    /* storage or matchMedia can be unavailable; DaisyUI's default theme applies */
  }
})();
