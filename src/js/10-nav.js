/* Navigation: Scroll-Zustand, Ein-/Ausblenden, aktiver Abschnitt, mobiles Menü */
(function () {
  AK.ready(function (AK) {
    var nav = AK.$('.nav');
    var burger = AK.$('.nav__burger');
    var menu = document.getElementById('navMenu');
    if (!nav) return;

    // Hintergrund ab 40 px, beim Runterscrollen ausblenden, beim Hochscrollen zeigen
    var lastY = scrollY, ticking = false;
    function onScroll() {
      var y = scrollY;
      nav.classList.toggle('is-scrolled', y > 40);
      var menuOpen = menu && !menu.hidden;
      nav.classList.toggle('is-hidden', !menuOpen && y > 600 && y > lastY + 4);
      if (y < lastY - 4 || y < 600) nav.classList.remove('is-hidden');
      lastY = y; ticking = false;
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    // Aktiven Abschnitt markieren
    var links = AK.$$('.nav__links a');
    if ('IntersectionObserver' in window) {
      var map = {};
      links.forEach(function (a) { var id = a.getAttribute('href').slice(1); var s = document.getElementById(id); if (s) map[id] = a; });
      // Alle Abschnitte beobachten: Abschnitte ohne eigenen Menüpunkt heben die Markierung auf
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (l) { l.classList.remove('is-active'); });
          if (map[en.target.id]) map[en.target.id].classList.add('is-active');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      AK.$$('main > section[id], body > footer, main ~ footer').forEach(function (s) { io.observe(s); });
    }

    // Mobiles Menü
    if (!burger || !menu) return;
    function setOpen(open) {
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      if (open) {
        menu.hidden = false; AK.lock(); nav.classList.add('is-scrolled');
        if (AK.motion) {
          gsap.fromTo(menu, { clipPath: 'circle(0% at 100% 0%)' }, { clipPath: 'circle(150% at 100% 0%)', duration: .8, ease: 'power3.inOut' });
          gsap.fromTo(menu.querySelectorAll('.nav-menu__links a, .nav-menu__foot > *'), { autoAlpha: 0, x: 30 },
            { autoAlpha: 1, x: 0, duration: .6, stagger: .04, delay: .2, ease: 'power3.out' });
        }
      } else {
        var done = function () { menu.hidden = true; AK.unlock(); onScroll(); };
        if (AK.motion) gsap.to(menu, { clipPath: 'circle(0% at 100% 0%)', duration: .55, ease: 'power3.inOut', onComplete: done });
        else done();
      }
    }
    burger.addEventListener('click', function () { setOpen(menu.hidden); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); burger.focus(); } });
    matchMedia('(min-width: 1061px)').addEventListener('change', function (m) { if (m.matches && !menu.hidden) setOpen(false); });
  });
})();
