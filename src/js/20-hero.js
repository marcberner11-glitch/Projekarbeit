/* Hero: Intro-Animation, Öffnungsstatus, Goldstaub, Maus-Parallaxe, Scroll-Ausblendung */
(function () {
  AK.ready(function (AK) {
    var hero = document.getElementById('hero');
    if (!hero) return;
    var video = AK.$('.hero__video', hero);
    var canvas = AK.$('.hero__dust', hero);

    /* Öffnungsstatus live (gleiche Regeln wie Reservierung) */
    var pill = AK.$('[data-open-status]', hero);
    function updStatus() {
      if (!pill) return;
      var s = AK.openStatus();
      pill.classList.toggle('is-open', s.open);
      pill.classList.toggle('is-closed', !s.open);
      pill.lastElementChild.textContent = s.label + (s.detail ? ' · ' + s.detail : '') + ' · Dienstag Ruhetag';
    }
    updStatus(); setInterval(updStatus, 60000);

    /* Video: bei Fehler ausblenden, bei reduzierter Bewegung stoppen */
    if (video) {
      var hide = function () { video.style.display = 'none'; };
      video.addEventListener('error', hide, true);
      var srcs = video.querySelectorAll('source');
      if (srcs.length) srcs[srcs.length - 1].addEventListener('error', hide);
      if (AK.reduceMotion) { video.removeAttribute('autoplay'); try { video.pause(); } catch (e) {} }
      // Nur abspielen, solange der Hero sichtbar ist (spart Akku)
      if ('IntersectionObserver' in window && !AK.reduceMotion) {
        new IntersectionObserver(function (en) {
          en.forEach(function (x) { if (x.isIntersecting) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } else video.pause(); });
        }).observe(hero);
      }
    }

    /* Goldstaub (Canvas) */
    if (canvas && !AK.reduceMotion) {
      var ctx = canvas.getContext('2d'), W = 0, H = 0, dpr = Math.min(devicePixelRatio || 1, 2), parts = [], running = true;
      var N = innerWidth < 700 ? 38 : 80;
      function resize() { W = hero.clientWidth; H = hero.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      function spawn(p, init) {
        p.x = Math.random() * W; p.y = init ? Math.random() * H : H + 10;
        p.r = .5 + Math.random() * 1.9; p.vy = .15 + Math.random() * .45; p.vx = (Math.random() - .5) * .25;
        p.a = .25 + Math.random() * .6; p.t = Math.random() * 6.28; p.s = .01 + Math.random() * .03;
        p.hue = 38 + Math.random() * 14; return p;
      }
      resize(); for (var i = 0; i < N; i++) parts.push(spawn({}, true));
      addEventListener('resize', resize);
      function frame() {
        if (!running) return;
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.t += p.s; p.y -= p.vy; p.x += p.vx + Math.sin(p.t) * .2;
          if (p.y < -10) spawn(p, false);
          var a = p.a * (.55 + .45 * Math.sin(p.t * 2));
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, 'hsla(' + p.hue + ',90%,72%,' + a + ')');
          g.addColorStop(1, 'hsla(' + p.hue + ',90%,60%,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.283); ctx.fill();
        }
        requestAnimationFrame(frame);
      }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          var vis = en[0].isIntersecting;
          if (vis && !running) { running = true; requestAnimationFrame(frame); } else if (!vis) running = false;
        }).observe(hero);
      }
      requestAnimationFrame(frame);
    }

    if (!AK.motion) return;

    /* Intro-Timeline */
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: .15 });
    tl.from('.hero__photo', { scale: 1.25, duration: 2.6, ease: 'power2.out' }, 0)
      .from('.hero__video', { autoAlpha: 0, duration: 2 }, .2)
      .from('.hero__cn span', { autoAlpha: 0, y: 24, filter: 'blur(8px)', stagger: .14, duration: 1 }, .35)
      .from('.hero__logo img', { autoAlpha: 0, scale: .86, filter: 'blur(14px)', duration: 1.5, ease: 'expo.out' }, .55)
      .from('.hero__tag', { autoAlpha: 0, letterSpacing: '.9em', duration: 1.4 }, 1)
      .from('.hero__status', { autoAlpha: 0, y: 14, duration: .8 }, 1.3)
      .from('.hero__btns > *', { autoAlpha: 0, y: 22, stagger: .1, duration: .8 }, 1.4)
      .from('.hero__facts li', { autoAlpha: 0, y: 14, stagger: .08, duration: .7 }, 1.7)
      .from('.hero__scroll', { autoAlpha: 0, duration: .8 }, 2);

    /* Beim Scrollen: Kamera fährt nach vorne, Inhalt hebt ab */
    gsap.to('.hero__content', { yPercent: -18, autoAlpha: 0, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 30%', scrub: true } });
    gsap.to('.hero__video', { scale: 1.18, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__photo', { yPercent: 10, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

    /* Maus-Parallaxe (nur Desktop) */
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var qx = gsap.quickTo('.hero__video', 'x', { duration: 1.2, ease: 'power3' });
      var qy = gsap.quickTo('.hero__video', 'y', { duration: 1.2, ease: 'power3' });
      var cx = gsap.quickTo('.hero__logo', 'x', { duration: 1.4, ease: 'power3' });
      var cy = gsap.quickTo('.hero__logo', 'y', { duration: 1.4, ease: 'power3' });
      hero.addEventListener('mousemove', function (e) {
        var nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
        qx(nx * -30); qy(ny * -18); cx(nx * 14); cy(ny * 8);
      });
    }
  });
})();
