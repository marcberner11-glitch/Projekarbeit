/* ==========================================================================
   90 · Footer – „Nach oben“
   ========================================================================== */
(function () {
  'use strict';
  AK.ready(function (AK) {
    AK.$$('[data-to-top]').forEach(function (b) {
      b.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: AK.reduceMotion ? 'auto' : 'smooth' });
        // Fokus an den Seitenanfang, damit Tastatur-Nutzer oben weitermachen
        var target = document.getElementById('main') || document.body;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        setTimeout(function () { target.focus({ preventScroll: true }); }, AK.reduceMotion ? 0 : 600);
      });
    });
  });
})();
