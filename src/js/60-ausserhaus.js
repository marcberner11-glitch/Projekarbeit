/* 60 · Außer Haus – Uhrzeiger der Abholzeiten drehen sich beim Einblenden auf ihre Zeit */
(function () {
  'use strict';
  AK.ready(function (AK) {
    if (!AK.motion) return;
    AK.$$('#togo .ah-slot').forEach(function (slot, i) {
      var hour = slot.querySelector('.ah-clock__spin:not(.ah-clock__spin--m)');
      var min = slot.querySelector('.ah-clock__spin--m');
      if (!hour || !min) return;
      var tl = gsap.timeline({ scrollTrigger: { trigger: slot, start: 'top 88%', once: true }, delay: .3 + i * .15 });
      tl.from(min, { rotation: -720, svgOrigin: '22 22', duration: 2, ease: 'power3.out' }, 0)
        .from(hour, { rotation: -120, svgOrigin: '22 22', duration: 2, ease: 'power3.out' }, 0);
    });
  });
})();
