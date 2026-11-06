/* Über uns: scroll-gesteuerte Blender-Bildsequenz „Tor öffnet sich“ */
(function () {
  AK.ready(function (AK) {
    var gate = AK.$('.gate');
    if (!gate) return;
    var sticky = AK.$('.gate__sticky', gate);
    var canvas = AK.$('.gate__canvas', gate);
    var poster = AK.$('.gate__poster', gate);
    var N = parseInt(gate.getAttribute('data-frames'), 10) || 60;
    var tpl = gate.getAttribute('data-src');

    // Poster fehlt → Foto als Hintergrund
    var fallbackBg = function () { gate.classList.add('is-fallback'); sticky.style.background = '#0a0406 url(images/innen-eingang.jpg) center/cover no-repeat'; };
    if (poster) {
      if (poster.complete && !poster.naturalWidth && poster.currentSrc) { poster.remove(); fallbackBg(); }
      else poster.addEventListener('error', function () { poster.remove(); fallbackBg(); });
    }

    if (!AK.motion) { gate.classList.add('is-static'); return; }

    var ctx = canvas.getContext('2d');
    var frames = new Array(N), loaded = 0, failed = 0, current = -1, started = false;
    var dpr = Math.min(devicePixelRatio || 1, 1.5);

    function size() {
      canvas.width = Math.round(sticky.clientWidth * dpr);
      canvas.height = Math.round(sticky.clientHeight * dpr);
      var c = current; current = -1; if (c >= 0) draw(c);
    }
    function draw(i) {
      i = Math.max(0, Math.min(N - 1, i));
      // nächstes geladenes Bild in der Nähe suchen
      var img = frames[i], k = 1;
      while ((!img || !img.complete || !img.naturalWidth) && k < N) {
        img = frames[i - k] && frames[i - k].naturalWidth ? frames[i - k] : (frames[i + k] && frames[i + k].naturalWidth ? frames[i + k] : null);
        k++;
      }
      if (!img || i === current) return;
      current = i;
      var cw = canvas.width, ch = canvas.height, iw = img.naturalWidth, ih = img.naturalHeight;
      var s = Math.max(cw / iw, ch / ih), w = iw * s, h = ih * s;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }
    function load() {
      if (started) return; started = true;
      for (var i = 0; i < N; i++) {
        (function (i) {
          var img = new Image();
          img.decoding = 'async';
          img.onload = function () { loaded++; if (i === 0 || loaded === 1) { gate.classList.add('is-ready'); size(); draw(0); } };
          img.onerror = function () { failed++; if (failed > N / 2) gate.classList.remove('is-ready'); };
          img.src = tpl.replace('{n}', ('00' + i).slice(-3));
          frames[i] = img;
        })(i);
      }
    }
    // Frames erst laden, wenn das Tor in die Nähe kommt
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '150% 0px' });
      io.observe(gate);
    } else load();
    addEventListener('resize', size);

    var proxy = { f: 0 };
    if (poster && poster.isConnected) gsap.fromTo(poster, { scale: 1 }, { scale: 1.35, ease: 'none', scrollTrigger: { trigger: gate, start: 'top top', end: 'bottom bottom', scrub: .5 } });
    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: gate, start: 'top top', end: 'bottom bottom', scrub: .5 }
    });
    // Frames 0–42: Tor öffnet sich, Kamera fährt hindurch (Großteil des Scrollwegs);
    // danach ist das Rendering fast nur noch goldenes Licht → kurz halten.
    var upd = function () { draw(Math.round(proxy.f)); };
    var GOLD = Math.round((N - 1) * 0.71);
    tl.to(proxy, { f: GOLD, duration: .66, ease: 'none', onUpdate: upd }, 0)
      .to(proxy, { f: N - 1, duration: .12, ease: 'none', onUpdate: upd }, .66)
      .to('.gate__hint', { autoAlpha: 0, duration: .06 }, 0)
      .to('.gate__copy--a', { autoAlpha: 0, y: -60, filter: 'blur(8px)', duration: .16 }, .12)
      .fromTo('.gate__copy--b', { autoAlpha: 0, y: 40, scale: .96 }, { autoAlpha: 1, y: 0, scale: 1, duration: .14 }, .40)
      .to('.gate__copy--b', { autoAlpha: 0, scale: 1.15, filter: 'blur(10px)', duration: .1 }, .58)
      .to('.gate__flash', { autoAlpha: 1, duration: .1, ease: 'power2.in' }, .64)
      .to('.gate__dark', { autoAlpha: 1, duration: .16, ease: 'power1.in' }, .78);
  });
})();
