/* 50 · Events – Lichtkegel auf den Karten, animierte Detail-Modals */
(function () {
  'use strict';
  AK.ready(function (AK) {
    var sec = document.getElementById('events');
    if (!sec) return;

    // Lichtkegel folgt der Maus (nur feine Zeiger)
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      AK.$$('.ev-card', sec).forEach(function (card) {
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
      });
    }

    // Modal-Inhalt beim Öffnen gestaffelt einblenden
    sec.addEventListener('ak:modal-open', function (e) {
      var m = e.target;
      if (!m.classList || !m.classList.contains('ev-modal')) return;
      AK.track('event_modal_open', { typ: m.id.replace('ev-modal-', '') });
      if (!AK.motion) return;
      var img = m.querySelector('.ev-modal__hero img');
      var badge = m.querySelector('.ev-modal__badge');
      var parts = m.querySelectorAll('.ev-modal__head > *, .ev-modal__line, .ev-modal__desc');
      var feats = m.querySelectorAll('.ev-modal__features li');
      var rest = m.querySelectorAll('.ev-modal__note, .ev-modal__cta');
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (img) tl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 1.6, ease: 'expo.out', clearProps: 'transform' }, 0);
      if (badge) tl.fromTo(badge, { scale: .4, rotate: -40, autoAlpha: 0 }, { scale: 1, rotate: 0, autoAlpha: 1, duration: .8, ease: 'back.out(1.8)', clearProps: 'transform' }, .15);
      tl.fromTo(parts, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .06, clearProps: 'transform' }, .2)
        .fromTo(feats, { x: -14, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .5, stagger: .05, clearProps: 'transform' }, .45)
        .fromTo(rest, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .08, clearProps: 'transform' }, .7);
    });
  });
})();
