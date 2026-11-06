/* Automatisch erzeugt aus src/js – bitte dort bearbeiten (node build.mjs) */

/* ─── 00-core.js ─── */
/* ==========================================================================
   Asia Khan – Kern-Skript
   Stellt window.AK bereit: Animationen (GSAP), Tabs, Modals, Tracking.
   Alle Abschnitts-Skripte (src/js/NN-*.js) laufen danach und nutzen AK.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  // Ohne GSAP oder bei reduzierter Bewegung: alles sofort sichtbar
  if (!hasGsap || reduce) root.classList.remove('js');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  var AK = window.AK = window.AK || {};
  AK.reduceMotion = reduce;
  AK.motion = hasGsap && !reduce;          // true = Animationen aktiv
  AK.$ = function (s, c) { return (c || document).querySelector(s); };
  AK.$$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ─── Tracking (vorbereitet, sendet nichts ohne Analyse-Tool) ───────────
     Erfasst Gäste-Aktionen nur als window.dataLayer-Events. Sobald z. B.
     Plausible / Matomo / GA4 (mit Einwilligung) eingebunden ist, werden die
     Events automatisch weitergereicht. */
  window.dataLayer = window.dataLayer || [];
  AK.track = window.akTrack = function (name, props) {
    props = props || {};
    window.dataLayer.push(Object.assign({ event: name }, props));
    try {
      if (typeof window.plausible === 'function') window.plausible(name, { props: props });
      if (typeof window.gtag === 'function') window.gtag('event', name, props);
      if (window._paq && window._paq.push) window._paq.push(['trackEvent', 'Gast-Aktion', name]);
    } catch (e) {}
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (!a) return;
    if (a.dataset && a.dataset.track) { AK.track(a.dataset.track); return; }
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) AK.track('click_call', { nummer: href.slice(4) });
    else if (href.indexOf('wa.me') > -1) AK.track('click_whatsapp');
    else if (/maps\.(google|apple)|google\.[a-z.]+\/maps|waze\.com/.test(href)) AK.track('click_route');
    else if (href.indexOf('mailto:') === 0) AK.track('click_email');
    else if (href.indexOf('toogoodtogo') > -1) AK.track('click_toogoodtogo');
  }, true);

  /* ─── Öffnungszeiten, Feiertage, Ruhetag ─────────────────────────────────
     Eine Quelle für Reservierung, Kontakt und Info-Leiste.
     Mo, Mi–Sa 11:30–15:00 & 17:30–22:00 · So & Feiertage 11:30–22:00 · Di Ruhetag
     (Ausnahme: gesetzlicher Feiertag in Hessen oder Sonder-Öffnungstag). */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toYMD(dt) { return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()); }
  function easterSunday(year) {
    var a = year % 19, b = Math.floor(year / 100), c = year % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }
  // Gesetzliche Feiertage in Hessen (feste + bewegliche, Oster-basiert)
  function hessenHolidays(year) {
    var E = easterSunday(year);
    function fromEaster(days) { var x = new Date(E); x.setDate(x.getDate() + days); return toYMD(x); }
    var h = {};
    h[year + '-01-01'] = 'Neujahr';
    h[year + '-05-01'] = 'Tag der Arbeit';
    h[year + '-10-03'] = 'Tag der Deutschen Einheit';
    h[year + '-12-25'] = '1. Weihnachtstag';
    h[year + '-12-26'] = '2. Weihnachtstag';
    h[fromEaster(-2)] = 'Karfreitag';
    h[fromEaster(1)] = 'Ostermontag';
    h[fromEaster(39)] = 'Christi Himmelfahrt';
    h[fromEaster(50)] = 'Pfingstmontag';
    h[fromEaster(60)] = 'Fronleichnam';
    return h;
  }
  // Sonder-Öffnungstage: an diesen Dienstagen ist trotz Ruhetag geöffnet (Aktionstage)
  // Format 'YYYY-MM-DD' – hier bei Bedarf weitere Aktionstage ergänzen.
  AK.SONDER_OEFFNUNGSTAGE = {
    '2026-08-11': 'Back to School'
  };
  AK.toYMD = toYMD;
  AK.parseYMD = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  AK.holidayName = function (ymd) { return hessenHolidays(parseInt(ymd.slice(0, 4), 10))[ymd] || ''; };
  AK.isHoliday = function (ymd) { return !!AK.holidayName(ymd); };
  // true = an diesem Tag geschlossen / keine Reservierung (Dienstag, kein Feiertag, kein Aktionstag)
  AK.isRuhetag = function (ymd) {
    if (!ymd) return false;
    if (AK.parseYMD(ymd).getDay() !== 2) return false;
    if (AK.SONDER_OEFFNUNGSTAGE[ymd]) return false;
    return !AK.isHoliday(ymd);
  };
  // Öffnungsfenster eines Tages als [[startMin, endMin], …]
  AK.openingWindows = function (date) {
    var ymd = toYMD(date), wd = date.getDay();
    if (AK.isRuhetag(ymd)) return [];
    if (wd === 0 || AK.isHoliday(ymd)) return [[690, 1320]];
    return [[690, 900], [1050, 1320]];
  };
  // Aktuelle Uhrzeit in Bürstadt (Europe/Berlin), unabhängig von der Zeitzone des Besuchers.
  // Liefert ein Date, dessen lokale Felder der deutschen Wanduhr entsprechen.
  AK.nowBerlin = function () {
    var d = new Date();
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
        .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return new Date(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    } catch (e) { return d; }
  };
  // Status jetzt: { open, label, detail }
  AK.openStatus = function (now) {
    now = now || AK.nowBerlin();
    var mins = now.getHours() * 60 + now.getMinutes();
    var fmt = function (m) { return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); };
    var win = AK.openingWindows(now);
    for (var i = 0; i < win.length; i++) {
      if (mins >= win[i][0] && mins < win[i][1]) {
        return { open: true, label: 'Jetzt geöffnet', detail: 'bis ' + fmt(win[i][1]) + ' Uhr' };
      }
    }
    for (i = 0; i < win.length; i++) {
      if (mins < win[i][0]) return { open: false, label: 'Gerade geschlossen', detail: 'öffnet heute um ' + fmt(win[i][0]) + ' Uhr' };
    }
    var names = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    for (var d = 1; d <= 7; d++) {
      var nd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
      var w = AK.openingWindows(nd);
      if (w.length) {
        return { open: false, label: AK.isRuhetag(toYMD(now)) ? 'Heute Ruhetag' : 'Gerade geschlossen',
          detail: 'öffnet ' + (d === 1 ? 'morgen' : names[nd.getDay()]) + ' um ' + fmt(w[0][0]) + ' Uhr' };
      }
    }
    return { open: false, label: 'Geschlossen', detail: '' };
  };

  /* ─── Body-Scroll sperren (Modals, Menü) ─────────────────────────────── */
  var lockCount = 0;
  AK.lock = function () { lockCount++; document.body.classList.add('is-locked'); };
  AK.unlock = function () { lockCount = Math.max(0, lockCount - 1); if (!lockCount) document.body.classList.remove('is-locked'); };

  /* ─── Modals ─────────────────────────────────────────────────────────────
     <div class="modal" id="x" hidden> <div class="modal__box"> … </div></div>
     Öffnen per [data-modal-open="x"] oder AK.modal.open('x'). */
  var openStack = [];
  AK.modal = {
    open: function (id, opener) {
      var m = document.getElementById(id);
      if (!m || !m.hidden) return;
      m._opener = opener || document.activeElement;
      m.hidden = false;
      // Reflow, damit die CSS-Animation neu startet
      void m.offsetWidth;
      m.classList.add('is-open');
      openStack.push(m);
      AK.lock();
      var f = m.querySelector('[autofocus], .modal__close, button, a, input');
      if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 40);
      m.dispatchEvent(new CustomEvent('ak:modal-open', { bubbles: true }));
    },
    close: function (id) {
      var m = id ? document.getElementById(id) : openStack[openStack.length - 1];
      if (!m || m.hidden) return;
      m.classList.remove('is-open');
      m.hidden = true;
      openStack = openStack.filter(function (x) { return x !== m; });
      AK.unlock();
      if (m._opener && m._opener.focus) m._opener.focus({ preventScroll: true });
      m.dispatchEvent(new CustomEvent('ak:modal-close', { bubbles: true }));
    }
  };
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-modal-open]');
    if (o) { e.preventDefault(); AK.modal.open(o.getAttribute('data-modal-open'), o); return; }
    var c = e.target.closest('[data-modal-close]');
    if (c) { e.preventDefault(); AK.modal.close(c.closest('.modal') && c.closest('.modal').id); return; }
    if (e.target.classList && e.target.classList.contains('modal')) AK.modal.close(e.target.id);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openStack.length) AK.modal.close();
    // einfacher Fokus-Ring innerhalb des obersten Modals
    if (e.key === 'Tab' && openStack.length) {
      var m = openStack[openStack.length - 1];
      var f = AK.$$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', m)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ─── Tabs ──────────────────────────────────────────────────────────────
     <div class="tabs" role="tablist" data-tabs>
       <button class="tab" role="tab" aria-selected="true" aria-controls="p1">…</button> …
     </div>  Panels: <div class="tab-panel" role="tabpanel" id="p1">…</div> (inaktive mit hidden)
     Löst auf dem Tablist-Element das Event 'ak:tab' aus (detail: {tab, panel}). */
  AK.selectTab = function (tab) {
    var list = tab.closest('[data-tabs]');
    if (!list) return;
    AK.$$('[role="tab"]', list).forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var p = document.getElementById(t.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
    var panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (panel && AK.motion) {
      gsap.fromTo(panel, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .55, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
      var kids = panel.querySelectorAll('[data-stagger] > *, [data-reveal]');
      if (kids.length) gsap.fromTo(kids, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: .6, stagger: .05, ease: 'power3.out', overwrite: true });
    }
    if (window.ScrollTrigger) setTimeout(function () { ScrollTrigger.refresh(); }, 60);
    list.dispatchEvent(new CustomEvent('ak:tab', { detail: { tab: tab, panel: panel } }));
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tabs] [role="tab"]');
    if (t) AK.selectTab(t);
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('[data-tabs] [role="tab"]');
    if (!t || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    var tabs = AK.$$('[role="tab"]', t.closest('[data-tabs]'));
    var i = tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
    var n = tabs[(i + tabs.length) % tabs.length];
    n.focus(); AK.selectTab(n);
  });

  /* ─── Akkordeon (details/summary) weich animieren ─────────────────────── */
  document.addEventListener('click', function (e) {
    var s = e.target.closest('details.acc > summary');
    if (!s || !AK.motion) return;
    var d = s.parentElement, body = d.querySelector('.acc__body');
    if (!body) return;
    e.preventDefault();
    if (d.open) {
      gsap.to(body, { height: 0, opacity: 0, duration: .35, ease: 'power2.inOut', onComplete: function () { d.open = false; gsap.set(body, { clearProps: 'all' }); } });
    } else {
      d.open = true;
      gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: .45, ease: 'power2.out', clearProps: 'height' });
    }
  });

  /* ─── Scroll-Animationen ─────────────────────────────────────────────── */
  function initMotion() {
    if (!AK.motion) return;

    // Überschriften wortweise aus einer Maske heben: [data-split]
    AK.$$('[data-split]').forEach(function (el) {
      if (el._split) return; el._split = true;
      var walk = function (node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var w = document.createElement('span'); w.className = 'sw';
              var i = document.createElement('span'); i.className = 'sw__i'; i.textContent = part;
              w.appendChild(i); frag.appendChild(w);
            });
            n.parentNode.replaceChild(frag, n);
          } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
        });
      };
      walk(el);
      gsap.from(el.querySelectorAll('.sw__i'), {
        yPercent: 110, rotate: 4, duration: 1.05, ease: 'power4.out', stagger: .055,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    // Einblenden: [data-reveal="up|down|left|right|fade|scale|clip|blur"]  (+ optional data-delay)
    var from = {
      up:    { y: 48 },
      down:  { y: -48 },
      left:  { x: -60 },
      right: { x: 60 },
      fade:  {},
      scale: { scale: .9 },
      blur:  { filter: 'blur(14px)', y: 20 },
      clip:  { clipPath: 'inset(12% 12% 12% 12% round 18px)', scale: 1.08 }
    };
    AK.$$('[data-reveal]').forEach(function (el) {
      var type = el.getAttribute('data-reveal') || 'up';
      var vars = Object.assign({ autoAlpha: 0 }, from[type] || from.up);
      var to = { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: type === 'clip' ? 1.4 : 1.1, ease: 'power3.out',
        delay: parseFloat(el.getAttribute('data-delay')) || 0,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true } };
      if (type === 'blur') to.filter = 'blur(0px)';
      if (type === 'clip') { to.clipPath = 'inset(0% 0% 0% 0% round 0px)'; to.ease = 'expo.out'; }
      to.clearProps = type === 'clip' ? 'clipPath,transform' : 'transform,filter';
      gsap.fromTo(el, vars, to);
    });

    // Kinder nacheinander: [data-stagger="0.08"]
    AK.$$('[data-stagger]').forEach(function (el) {
      var kids = Array.prototype.slice.call(el.children);
      if (!kids.length) return;
      gsap.fromTo(kids, { autoAlpha: 0, y: 36 }, {
        autoAlpha: 1, y: 0, duration: .9, ease: 'power3.out', stagger: parseFloat(el.getAttribute('data-stagger')) || .09,
        clearProps: 'transform', scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    // Parallaxe: [data-parallax="0.15"]  (positiv = langsamer, bewegt sich nach unten)
    AK.$$('[data-parallax]').forEach(function (el) {
      var f = parseFloat(el.getAttribute('data-parallax')) || .15;
      gsap.fromTo(el, { yPercent: -f * 50 }, { yPercent: f * 50, ease: 'none',
        scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // Kamerafahrt („Dolly-In“) auf Bildern: .kb > img
    AK.$$('.kb').forEach(function (box) {
      var img = box.querySelector('img, video');
      if (!img) return;
      gsap.fromTo(img, { scale: 1.22, yPercent: -4 }, { scale: 1.02, yPercent: 4, ease: 'none',
        scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: .6 } });
    });

    // Zähler: <span data-count="74" data-suffix="+">0</span>
    AK.$$('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count')), suf = el.getAttribute('data-suffix') || '';
      var dec = (String(end).split('.')[1] || '').length;
      var o = { v: 0 };
      gsap.to(o, { v: end, duration: 2, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: function () { el.textContent = o.v.toFixed(dec).replace('.', ',') + suf; } });
    });

    // Magnetische Haupt-Buttons (nur Maus)
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      AK.$$('.btn--gold, [data-magnetic]').forEach(function (b) {
        b.addEventListener('mousemove', function (e) {
          var r = b.getBoundingClientRect();
          gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * .18, y: (e.clientY - r.top - r.height / 2) * .3, duration: .4, ease: 'power3.out' });
        });
        b.addEventListener('mouseleave', function () { gsap.to(b, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1, .4)' }); });
      });
    }
  }

  /* ─── Seitenfortschritt (dünne Goldlinie oben) ───────────────────────── */
  function initProgress() {
    var bar = AK.$('.page-progress span');
    if (!bar) return;
    var tick = false;
    var upd = function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? scrollY / h : 0) + ')';
      tick = false;
    };
    addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  /* ─── Start: Abschnitts-Module registrieren sich über AK.ready(fn) ────── */
  var queue = [];
  AK.ready = function (fn) { queue.push(fn); };
  document.addEventListener('DOMContentLoaded', function () {
    initProgress();
    // Abschnitts-Skripte zuerst (sie können DOM erzeugen), dann Animationen
    queue.forEach(function (fn) { try { fn(AK); } catch (err) { console.error('[AK]', err); } });
    initMotion();
    if (hasGsap) {
      addEventListener('load', function () { ScrollTrigger.refresh(); });
    }
  });
})();

/* ─── 10-nav.js ─── */
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
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && map[en.target.id]) {
            links.forEach(function (l) { l.classList.remove('is-active'); });
            map[en.target.id].classList.add('is-active');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
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

/* ─── 20-hero.js ─── */
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

/* ─── 25-quickinfo.js ─── */
/* Info-Leiste: Live-Öffnungsstatus */
(function () {
  AK.ready(function (AK) {
    var item = AK.$('.qi__item--status');
    if (!item) return;
    var lab = AK.$('[data-open-label]', item), det = AK.$('[data-open-detail]', item);
    function upd() {
      var s = AK.openStatus();
      item.classList.toggle('is-open', s.open);
      item.classList.toggle('is-closed', !s.open);
      lab.textContent = s.label;
      det.textContent = s.detail || 'Dienstag Ruhetag';
    }
    upd(); setInterval(upd, 60000);
  });
})();

/* ─── 30-ueber.js ─── */
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
    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: gate, start: 'top top', end: 'bottom bottom', scrub: .5 }
    });
    tl.to(proxy, { f: N - 1, duration: .86, ease: 'power1.inOut', onUpdate: function () { draw(Math.round(proxy.f)); } }, 0)
      .to('.gate__hint', { autoAlpha: 0, duration: .06 }, 0)
      .fromTo('.gate__poster', { scale: 1 }, { scale: 1.35, duration: .86 }, 0)   // Fallback-Bewegung, falls keine Frames
      .to('.gate__copy--a', { autoAlpha: 0, y: -60, filter: 'blur(8px)', duration: .2 }, .14)
      .fromTo('.gate__copy--b', { autoAlpha: 0, y: 40, scale: .96 }, { autoAlpha: 1, y: 0, scale: 1, duration: .16 }, .38)
      .to('.gate__copy--b', { autoAlpha: 0, scale: 1.15, filter: 'blur(10px)', duration: .12 }, .64)
      .to('.gate__flash', { autoAlpha: 1, duration: .14, ease: 'power2.in' }, .74)
      .to('.gate__flash', { background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(13,5,8,1), rgba(13,5,8,1) 40%, rgba(13,5,8,1) 100%)', duration: .12 }, .88);
  });
})();

/* ─── 35-video.js ─── */
/* Video: eigener Play-Button, 3D-Kippen + Heranzoomen beim Scrollen */
(function () {
  AK.ready(function (AK) {
    var sec = document.getElementById('video');
    if (!sec) return;
    var v = AK.$('.vid__player', sec), btn = AK.$('.vid__play', sec), frame = AK.$('.vid__frame', sec);

    btn.addEventListener('click', function () {
      v.controls = true;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      sec.classList.add('is-playing');
      AK.track('video_play');
    });
    v.addEventListener('play', function () { sec.classList.add('is-playing'); v.controls = true; });

    if (!AK.motion) return;
    gsap.fromTo(frame, { rotateX: 18, scale: .84, y: 40, autoAlpha: .55 }, {
      rotateX: 0, scale: 1, y: 0, autoAlpha: 1, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top 85%', end: 'center 55%', scrub: .6 }
    });
  });
})();

/* ─── 50-events.js ─── */
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
