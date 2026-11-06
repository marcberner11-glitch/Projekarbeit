/* ==========================================================================
   95 – Overlays
   · Event-Popup „Russische Live-Musik-Nacht“ (27.11.2026): 1,2 s nach dem
     Laden, einmal pro Sitzung (sessionStorage 'rnSeen'), ab 28.11.2026 00:00
     Uhr nie mehr. Nutzt das generische Modal (AK.modal: Esc, Hintergrund-
     Klick, Fokus-Rückgabe).
   · Mobile Aktionsleiste: ausgeblendet, solange das Reservierungsformular
     sichtbar ist oder ein Overlay / Menü offen ist.
   ========================================================================== */
(function () {
  'use strict';

  window.AK.ready(function (AK) {
    /* ─── Event-Popup ──────────────────────────────────────────────────── */
    var RN_END = new Date(2026, 10, 28, 0, 0, 0); // Popup nur bis einschließlich 27.11.2026
    var popup = document.getElementById('rnPopup');
    var markSeen = function () { try { sessionStorage.setItem('rnSeen', '1'); } catch (e) {} };

    if (popup) {
      if (new Date() >= RN_END) {
        popup.parentNode.removeChild(popup);
      } else {
        var seen = false;
        try { seen = sessionStorage.getItem('rnSeen') === '1'; } catch (e) {}
        popup.addEventListener('ak:modal-close', markSeen);
        var cta = popup.querySelector('.ov-rn__cta');
        if (cta) cta.addEventListener('click', markSeen);

        if (!seen) {
          // Bandfoto schon vorladen, damit es beim Öffnen bereitsteht
          var img = popup.querySelector('img');
          if (img) img.loading = 'eager';
          var tries = 0;
          var tryOpen = function () {
            // Läuft gerade ein anderes Overlay / Menü? Dann kurz warten statt zu stören.
            if ((document.body.classList.contains('is-locked') || AK.$('.modal.is-open')) && tries++ < 20) {
              setTimeout(tryOpen, 1500);
              return;
            }
            if (new Date() < RN_END && popup.hidden) AK.modal.open('rnPopup');
          };
          setTimeout(tryOpen, 1200);
        }
      }
    }

    /* ─── Mobile Aktionsleiste ─────────────────────────────────────────── */
    var bar = AK.$('.mobile-cta');
    if (!bar) return;
    var formInView = false, overlayOpen = false;
    var update = function () { bar.classList.toggle('is-hidden', formInView || overlayOpen); };

    var target = AK.$('#reservierung .rs-card') || AK.$('.reservation-form');
    if (target && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        formInView = entries[entries.length - 1].isIntersecting;
        update();
      }, { threshold: 0 }).observe(target);
    }

    var checkOverlay = function () {
      overlayOpen = document.body.classList.contains('is-locked') || !!AK.$('.modal.is-open');
      update();
    };
    if ('MutationObserver' in window) {
      new MutationObserver(checkOverlay).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('ak:modal-open', checkOverlay);
    document.addEventListener('ak:modal-close', checkOverlay);
    checkOverlay();
  });
})();
