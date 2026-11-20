(function () {
  if (location.hostname === 'wheelhq.xyz' || location.hostname === 'www.wheelhq.xyz') return;
  var meta = document.querySelector('meta[name="robots"]');
  if (meta) meta.setAttribute('content', 'noindex,nofollow');
})();
