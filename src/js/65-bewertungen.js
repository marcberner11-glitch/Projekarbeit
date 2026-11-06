/* ==========================================================================
   65 · Google Bewertungen
   – Sterne füllen sich auf 4,2 (Zahl zählt über data-count im Kern hoch)
   – Desktop mit Maus: Laufband, pausiert bei Hover/Fokus/Pause-Taste
   – sonst: Wisch-Reihe mit Punkten & Pfeilen (bzw. Raster ab 1024 px)
   ========================================================================== */
(function () {
  'use strict';
  AK.ready(function (AK) {
    var sec = AK.$('#bewertungen');
    if (!sec) return;
    var car = AK.$('[data-rv]', sec);
    var vp = AK.$('.rv-viewport', car);
    var track = AK.$('.rv-track', car);
    var cards = AK.$$('.rv-card', track);
    var dotsBox = AK.$('.rv-dots', car);
    var prev = AK.$('.rv-arrow--prev', car);
    var next = AK.$('.rv-arrow--next', car);
    var pauseBtn = AK.$('.rv-pause', car);
    var smooth = AK.reduceMotion ? 'auto' : 'smooth';

    /* ─── Sterne-Füllung + Zahl ─────────────────────────────────────── */
    var num = AK.$('.rv-num', sec);
    var fill = AK.$('.rv-rating__fill', sec);
    if (AK.motion) {
      if (num) num.textContent = '0,0';
      if (fill) {
        gsap.from(fill, { width: 0, duration: 2, ease: 'power2.out', delay: .1, clearProps: 'width',
          scrollTrigger: { trigger: fill, start: 'top 90%', once: true } });
      }
    }

    /* ─── Punkte & Pfeile (Wisch-Reihe) ────────────────────────────── */
    var dots = cards.map(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rv-dot';
      b.setAttribute('aria-label', 'Bewertung ' + (i + 1) + ' von ' + cards.length);
      b.addEventListener('click', function () { goTo(i); });
      dotsBox.appendChild(b);
      return b;
    });
    function step() {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 16;
      return cards[0].getBoundingClientRect().width + gap;
    }
    function goTo(i) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      vp.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: smooth });
    }
    function current() {
      var max = vp.scrollWidth - vp.clientWidth;
      if (vp.scrollLeft >= max - 4) return cards.length - 1;
      return Math.round(vp.scrollLeft / step());
    }
    function sync() {
      if (car.classList.contains('is-marquee')) return;
      var c = current(), max = vp.scrollWidth - vp.clientWidth;
      dots.forEach(function (d, i) { d.setAttribute('aria-current', i === c ? 'true' : 'false'); });
      prev.disabled = vp.scrollLeft <= 4;
      next.disabled = vp.scrollLeft >= max - 4;
    }
    var raf = 0;
    vp.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; sync(); }); }, { passive: true });
    prev.addEventListener('click', function () { vp.scrollBy({ left: -step(), behavior: smooth }); });
    next.addEventListener('click', function () { vp.scrollBy({ left: step(), behavior: smooth }); });
    sync();

    /* ─── Laufband ─────────────────────────────────────────────────── */
    var mq = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
    var tween = null, clones = [], st = null, hover = false, manual = false;

    function setSpeed() {
      if (!tween) return;
      var stop = hover || manual;
      gsap.to(tween, { timeScale: stop ? 0 : 1, duration: stop ? .5 : .9, ease: 'power2.out', overwrite: true });
    }
    function enable() {
      if (tween) return;
      car.classList.add('is-marquee');
      vp.removeAttribute('tabindex');
      vp.scrollLeft = 0;
      clones = cards.map(function (c) {
        var k = c.cloneNode(true);
        k.setAttribute('aria-hidden', 'true');
        k.setAttribute('inert', '');
        k.classList.add('is-clone');
        track.appendChild(k);
        return k;
      });
      tween = gsap.to(track, { xPercent: -50, ease: 'none', duration: cards.length * 11, repeat: -1 });
      st = ScrollTrigger.create({ trigger: car, start: 'top bottom', end: 'bottom top',
        onToggle: function (self) { if (tween) { if (self.isActive) tween.play(); else tween.pause(); } } });
      if (!st.isActive) tween.pause();
      setSpeed();
    }
    function disable() {
      if (!tween) return;
      tween.kill(); tween = null;
      if (st) { st.kill(); st = null; }
      gsap.set(track, { clearProps: 'transform' });
      clones.forEach(function (k) { k.remove(); });
      clones = [];
      car.classList.remove('is-marquee');
      vp.setAttribute('tabindex', '0');
      sync();
    }
    function mode() { if (AK.motion && mq.matches) enable(); else disable(); }

    car.addEventListener('mouseenter', function () { hover = true; setSpeed(); });
    car.addEventListener('mouseleave', function () { hover = false; setSpeed(); });
    car.addEventListener('focusin', function () { hover = true; setSpeed(); });
    car.addEventListener('focusout', function (e) { if (!car.contains(e.relatedTarget)) { hover = false; setSpeed(); } });
    pauseBtn.addEventListener('click', function () {
      manual = !manual;
      pauseBtn.setAttribute('aria-pressed', manual ? 'true' : 'false');
      pauseBtn.setAttribute('aria-label', manual ? 'Laufband fortsetzen' : 'Laufband anhalten');
      setSpeed();
    });

    mode();
    if (mq.addEventListener) mq.addEventListener('change', mode);
    else if (mq.addListener) mq.addListener(mode);
    window.addEventListener('resize', function () { if (!tween) sync(); }, { passive: true });
  });
})();
