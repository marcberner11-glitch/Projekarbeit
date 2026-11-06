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
      gsap.fromTo(img, { scale: 1.24, yPercent: -4 }, { scale: 1.1, yPercent: 3.5, ease: 'none',
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

  /* ─── Sichtbarkeits-Tracking wichtiger Abschnitte (wie bisherige Seite) ── */
  function initViewTracking() {
    if (!('IntersectionObserver' in window)) return;
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !seen[en.target.id]) { seen[en.target.id] = 1; AK.track('view_' + en.target.id); }
      });
    }, { threshold: 0.35 });
    ['buffet', 'speisekarte', 'reservierung', 'events', 'kontakt'].forEach(function (id) {
      var el = document.getElementById(id); if (el) io.observe(el);
    });
  }

  /* ─── Start: Abschnitts-Module registrieren sich über AK.ready(fn) ────── */
  var queue = [];
  AK.ready = function (fn) { queue.push(fn); };
  document.addEventListener('DOMContentLoaded', function () {
    initProgress();
    initViewTracking();
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

/* ─── 40-buffet.js ─── */
/* ==========================================================================
   40 · Buffet & Preise
   – öffnet ab 15:00 Uhr automatisch den Abendbuffet-Tab
   – markiert die heute gültigen Preiskarten mit „Heute“
   – Preise zählen beim Einblenden / Tab-Wechsel kurz hoch (nur mit Bewegung)
   – Deep-Links: #bf-mittag / #bf-abend öffnen den jeweiligen Tab
   ========================================================================== */
(function () {
  'use strict';

  AK.ready(function (AK) {
    var sec = document.getElementById('buffet');
    if (!sec) return;
    var list = AK.$('[data-tabs="buffet"]', sec);
    var tabMittag = AK.$('#bf-tab-mittag', sec), tabAbend = AK.$('#bf-tab-abend', sec);
    if (!list || !tabMittag || !tabAbend) return;

    // Tab ohne Animation setzen (beim Start, bevor die Scroll-Animationen laufen)
    function setTabSilently(tab) {
      AK.$$('[role="tab"]', list).forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute('aria-controls'));
        if (p) p.hidden = !on;
      });
    }

    var now = AK.nowBerlin();
    var ymd = AK.toYMD(now), wd = now.getDay();
    var hash = (location.hash || '').slice(1);
    if (hash === 'bf-abend') setTabSilently(tabAbend);
    else if (hash === 'bf-mittag') setTabSilently(tabMittag);
    else if (now.getHours() >= 15) setTabSilently(tabAbend);

    // „Heute“-Markierung
    var holiday = AK.isHoliday(ymd);
    if (!AK.isRuhetag(ymd)) {
      AK.$$('.bf-card[data-days]', sec).forEach(function (card) {
        var match = holiday ? card.hasAttribute('data-holiday') : card.getAttribute('data-days').indexOf(String(wd)) > -1;
        if (!match) return;
        card.classList.add('is-today');
        var b = document.createElement('span');
        b.className = 'bf-today';
        b.textContent = 'Heute';
        var h = card.querySelector('.bf-card__head');
        card.insertBefore(b, h);
      });
    }

    // Deep-Links innerhalb der Seite (#bf-abend / #bf-mittag)
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href="#bf-abend"], a[href="#bf-mittag"]');
      if (!a) return;
      e.preventDefault();
      AK.selectTab(a.getAttribute('href') === '#bf-abend' ? tabAbend : tabMittag);
      sec.scrollIntoView({ behavior: AK.motion ? 'smooth' : 'auto', block: 'start' });
    });

    list.addEventListener('ak:tab', function (e) {
      var panel = e.detail && e.detail.panel;
      AK.track('buffet_tab', { tab: panel && panel.id === 'bf-abend' ? 'abend' : 'mittag' });
      if (panel) countUp(panel, .15);
    });

    if (!AK.motion) return;

    // Preise kurz hochzählen
    function countUp(panel, delay) {
      if (!AK.motion) return;
      AK.$$('.bf-price__num', panel).forEach(function (el, i) {
        var end = parseInt(el.getAttribute('data-v') || el.textContent, 10);
        if (isNaN(end)) return;
        el.setAttribute('data-v', end);
        var o = { v: Math.max(0, end - 12) };
        gsap.killTweensOf(el._bfObj || {});
        el._bfObj = o;
        el.textContent = Math.round(o.v);
        gsap.to(o, { v: end, duration: 1.1, delay: (delay || 0) + i * .12, ease: 'power3.out',
          onUpdate: function () { el.textContent = Math.round(o.v); } });
      });
    }

    AK.$$('.bf-panel', sec).forEach(function (panel) {
      ScrollTrigger.create({
        trigger: panel, start: 'top 82%', once: true,
        onEnter: function () { if (!panel.hidden) countUp(panel, .25); }
      });
    });
  });
})();

/* ─── 45-speisekarte.js ─── */
/* ==========================================================================
   45 · Speisekarte
   – Kategorie-Filter (Chips, aria-pressed) + Live-Suche (Name, Beschreibung, Nummer)
   – freundlicher Leer-Zustand, animiertes Filtern (GSAP, nur mit Bewegung)
   – Blender-Render (Dämpfkorb): webp → png → ausblenden, falls nicht vorhanden
   – Deep-Link: #mk-karte öffnet direkt „À la Carte & Zum Mitnehmen“
   ========================================================================== */
(function () {
  'use strict';

  AK.ready(function (AK) {
    var sec = document.getElementById('speisekarte');
    if (!sec) return;

    /* ─── Dekoration: Render laden, sonst entfernen ─────────────────────── */
    var deco = AK.$('.mk-deco', sec), img = deco && AK.$('img', deco);
    if (img) {
      var done = false;
      var ok = function () { if (img.naturalWidth > 0) { done = true; deco.classList.add('is-loaded'); } };
      var fail = function () {
        if (done) return;
        var fb = img.getAttribute('data-fallback');
        if (fb && img.getAttribute('src') !== fb) { img.setAttribute('src', fb); return; }
        done = true; deco.parentNode && deco.parentNode.removeChild(deco);
      };
      img.addEventListener('load', ok);
      img.addEventListener('error', fail);
      if (img.complete) { if (img.naturalWidth > 0) ok(); else if (img.getAttribute('src')) fail(); }
    }

    /* ─── Tabs: Deep-Link #mk-karte ─────────────────────────────────────── */
    var tabKarte = AK.$('#mk-tab-karte', sec), tabBuffet = AK.$('#mk-tab-buffet', sec);
    function showKarte(scroll) {
      if (!tabKarte) return;
      if (tabKarte.getAttribute('aria-selected') !== 'true') AK.selectTab(tabKarte);
      if (scroll) sec.scrollIntoView({ behavior: AK.motion ? 'smooth' : 'auto', block: 'start' });
    }
    if (location.hash === '#mk-karte' && tabKarte && tabBuffet) {
      // ohne Animation öffnen (vor dem Start der Scroll-Animationen)
      tabBuffet.setAttribute('aria-selected', 'false'); tabBuffet.tabIndex = -1;
      tabKarte.setAttribute('aria-selected', 'true'); tabKarte.tabIndex = 0;
      AK.$('#mk-buffet', sec).hidden = true; AK.$('#mk-karte', sec).hidden = false;
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href="#mk-karte"]');
      if (!a) return;
      e.preventDefault();
      showKarte(true);
    });
    var tablist = AK.$('[data-tabs="speisekarte"]', sec);
    if (tablist) tablist.addEventListener('ak:tab', function (e) {
      var p = e.detail && e.detail.panel;
      AK.track('menu_tab', { tab: p && p.id === 'mk-karte' ? 'a-la-carte' : 'buffet' });
      // Karten der Speisekarte nacheinander einblenden
      if (p && p.id === 'mk-karte' && AK.motion) {
        var vis = AK.$$('.mk-cat:not([hidden])', p).slice(0, 6);
        if (vis.length) gsap.fromTo(vis, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: .6, delay: .1, stagger: .07, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity,visibility' });
      }
    });

    /* ─── Filter & Suche ────────────────────────────────────────────────── */
    var grid = AK.$('#mk-grid', sec);
    if (!grid) return;
    var input = AK.$('#mk-q', sec), clear = AK.$('.mk-search__clear', sec);
    var chips = AK.$$('.mk-chips .chip', sec);
    var status = AK.$('#mk-status', sec), tools = AK.$('.mk-tools', sec);
    var empty = AK.$('.mk-empty', sec), emptyAlt = AK.$('.mk-empty__alt', sec);
    var btnAll = AK.$('.mk-empty__all', sec), btnReset = AK.$('.mk-empty__reset', sec);
    var active = 'alle';

    function norm(s) {
      return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/ß/g, 'ss').replace(/[„“”"()–—,.:;!?]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    var cats = AK.$$('.mk-cat', grid).map(function (cat) {
      var items = AK.$$('.mk-item', cat).map(function (it) {
        var num = AK.$('.mk-item__num', it), name = AK.$('.mk-item__name', it), desc = AK.$('.mk-item__desc', it);
        var hl = [name, desc].filter(Boolean).map(function (el) { return { el: el, text: el.textContent }; });
        return { el: it, num: norm(num.textContent).replace(/\s/g, ''), txt: norm(it.textContent), hl: hl };
      });
      return { el: cat, id: cat.getAttribute('data-cat'), items: items, count: AK.$('.mk-cat__count', cat), total: items.length };
    });
    var TOTAL = cats.reduce(function (n, c) { return n + c.total; }, 0);

    function tokens(q) { q = norm(q); return q ? q.split(' ') : []; }
    function isNumTok(t) { return /^[a-z]?\d+$/.test(t); }
    function matches(item, toks) {
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (isNumTok(t)) { if (item.num.indexOf(t) !== 0) return false; }
        else if (item.txt.indexOf(t) < 0) return false;
      }
      return true;
    }
    function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function highlight(item, raw) {
      var words = raw.trim().split(/\s+/).filter(function (w) { return w.length > 1 && !isNumTok(norm(w)); });
      var re = words.length ? new RegExp('(' + words.map(escRe).join('|') + ')', 'gi') : null;
      item.hl.forEach(function (h) {
        if (!re) { if (h.el.childElementCount) h.el.textContent = h.text; return; }
        var parts = h.text.split(re);
        if (parts.length === 1) { if (h.el.childElementCount) h.el.textContent = h.text; return; }
        h.el.textContent = '';
        parts.forEach(function (p, i) {
          if (!p) return;
          if (i % 2) { var m = document.createElement('mark'); m.textContent = p; h.el.appendChild(m); }
          else h.el.appendChild(document.createTextNode(p));
        });
      });
    }
    function plural(n) { return n + (n === 1 ? ' Gericht' : ' Gerichte'); }

    // Wendet Filter + Suche an; liefert neu sichtbar gewordene Elemente (für Animation)
    function apply() {
      var raw = input ? input.value : '', toks = tokens(raw);
      var shown = 0, shownCats = 0, appeared = [], elsewhere = 0;
      cats.forEach(function (c) {
        var inCat = active === 'alle' || c.id === active, n = 0;
        c.items.forEach(function (it) {
          var hit = matches(it, toks);
          if (hit && !inCat) elsewhere++;
          var on = hit && inCat;
          if (on && it.el.hidden) appeared.push(it.el);
          it.el.hidden = !on;
          if (on) { n++; highlight(it, raw); }
        });
        var wasHidden = c.el.hidden;
        c.el.hidden = n === 0;
        if (n) { shownCats++; if (wasHidden) appeared.push(c.el); }
        if (c.count) c.count.textContent = n === c.total ? plural(c.total) : n + ' von ' + c.total;
        shown += n;
      });
      grid.setAttribute('data-visible', String(Math.min(shownCats, 3)));
      grid.hidden = shown === 0;
      if (empty) empty.hidden = shown > 0;
      if (emptyAlt && btnAll) {
        var alt = shown === 0 && active !== 'alle' && elsewhere > 0;
        emptyAlt.hidden = btnAll.hidden = !alt;
        if (alt) emptyAlt.textContent = 'In anderen Kategorien gibt es ' + plural(elsewhere) + ' zu Ihrer Suche.';
      }
      if (status) status.textContent = (!toks.length && active === 'alle') ? plural(TOTAL) : (shown ? plural(shown) + ' gefunden' : 'Keine Treffer');
      if (clear) clear.hidden = !raw;
      refreshST();
      return appeared;
    }

    // Seitenhöhe ändert sich beim Filtern → Scroll-Trigger der folgenden Abschnitte neu berechnen
    var rId = 0, ready = false;
    function refreshST() {
      if (!ready || !window.ScrollTrigger) return;
      clearTimeout(rId);
      rId = setTimeout(function () { rId = 0; ScrollTrigger.refresh(); }, 350);
    }
    // ausstehende Neuberechnung sofort ausführen (vor weichem Scrollen, das refresh() sonst abbricht)
    function flushST() {
      if (!rId) return;
      clearTimeout(rId); rId = 0;
      ScrollTrigger.refresh();
    }

    function animateIn(els, stagger) {
      if (!AK.motion || !els.length) return;
      gsap.fromTo(els, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .5, ease: 'power3.out', stagger: stagger || .04, overwrite: true, clearProps: 'transform,opacity,visibility' });
    }

    // Wenn die Werkzeugleiste klebt, nach dem Filtern zum Anfang der Ergebnisse springen.
    // Beim Hochscrollen blendet sich die Navigation wieder ein → deren Höhe einrechnen.
    function keepInView() {
      if (!tools) return;
      flushST();
      var navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
      var target = (grid.hidden ? empty : grid);
      var top = target.getBoundingClientRect().top + window.pageYOffset;
      var off = navH + 8 + tools.offsetHeight + 16;
      if (top < window.pageYOffset + off) {
        window.scrollTo({ top: Math.max(0, top - off), behavior: AK.motion ? 'smooth' : 'auto' });
      }
    }

    function setChip(id, opts) {
      opts = opts || {};
      active = id;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-filter') === id ? 'true' : 'false'); });
      var run = function () {
        apply();
        var visible = cats.filter(function (c) { return !c.el.hidden; }).map(function (c) { return c.el; });
        animateIn(grid.hidden ? [empty] : visible, .06);
        if (!opts.noScroll) keepInView();
      };
      if (AK.motion && !opts.instant) {
        gsap.to([grid, empty], { autoAlpha: 0, y: 8, duration: .16, ease: 'power1.in', overwrite: true, onComplete: function () {
          gsap.set([grid, empty], { clearProps: 'opacity,visibility,transform' });
          run();
        } });
      } else run();
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var id = chip.getAttribute('data-filter');
        if (id === active) return;
        setChip(id);
        AK.track('menu_filter', { kategorie: id });
        // aktiven Chip in der wischbaren Leiste sichtbar halten
        if (chip.scrollIntoView && chip.parentElement.scrollWidth > chip.parentElement.parentElement.clientWidth) {
          try { chip.scrollIntoView({ behavior: AK.motion ? 'smooth' : 'auto', block: 'nearest', inline: 'center' }); } catch (e) {}
        }
      });
    });

    var tId = 0, trackId = 0;
    if (input) {
      input.addEventListener('input', function () {
        clearTimeout(tId);
        tId = setTimeout(function () {
          var appeared = apply();
          animateIn(grid.hidden ? [empty] : appeared.slice(0, 40), .02);
        }, 90);
        clearTimeout(trackId);
        trackId = setTimeout(function () { if (input.value.trim()) AK.track('menu_search', { suche: input.value.trim().slice(0, 40) }); }, 1200);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; animateIn(apply(), .02); }
        if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tId); animateIn(apply(), .02); input.blur(); keepInView(); }
      });
    }
    if (clear) clear.addEventListener('click', function () { input.value = ''; animateIn(apply(), .02); input.focus(); });
    if (btnAll) btnAll.addEventListener('click', function () { setChip('alle'); });
    if (btnReset) btnReset.addEventListener('click', function () { if (input) input.value = ''; setChip('alle'); });

    apply();
    ready = true;
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

/* ─── 60-ausserhaus.js ─── */
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

/* ─── 65-bewertungen.js ─── */
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

/* ─── 70-galerie.js ─── */
/* ==========================================================================
   70 · Galerie
   – Filter mit FLIP-Animation (eigene Umsetzung, ohne Flip-Plugin)
   – Kacheln enthüllen sich beim Scrollen (Clip-Reveal)
   – Lightbox: Zoom aus der Kachel, ←/→/Esc, Wischen, Zähler, Fokusfalle,
     berücksichtigt den aktiven Filter, lädt Nachbarbilder vor
   ========================================================================== */
(function () {
  'use strict';
  AK.ready(function (AK) {
    var sec = AK.$('#galerie');
    if (!sec) return;
    var G = window.gsap;
    var grid = AK.$('#gl-grid', sec);
    var items = AK.$$('.gl-item', grid);
    var chips = AK.$$('.gl-chip', sec);
    var live = AK.$('#gl-live', sec);
    var active = 'alle';
    var busy = null;

    function visible() { return items.filter(function (it) { return !it.hidden; }); }
    function matches(it, cat) { return cat === 'alle' || it.getAttribute('data-cat') === cat; }
    function refresh() { if (window.ScrollTrigger) ScrollTrigger.refresh(); }

    /* ─── Blocksatz-Layout (gleich hohe Reihen, kein Beschnitt) ────────
       CSS liefert ohne JS bereits ein flex-basiertes Raster; hier werden die
       Reihen exakt berechnet und eine zu kurze letzte Reihe in die
       vorherige übernommen, damit kein einzelnes Bild „verwaist“. */
    var ratios = items.map(function (it) {
      var im = AK.$('img', it);
      return (+im.getAttribute('width') || 4) / (+im.getAttribute('height') || 3);
    });
    var lastW = 0;
    function layout() {
      var cs = getComputedStyle(grid);
      var W = grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var gap = parseFloat(cs.columnGap) || 8;
      var H = parseFloat(cs.getPropertyValue('--h')) || 260;
      if (!W) return;
      lastW = W;
      var vis = items.filter(function (it) { return !it.hidden; });
      var rows = [], row = [], sum = 0;
      var hOf = function (n, s) { return (W - gap * (n - 1)) / s; };
      vis.forEach(function (it) {
        var ar = ratios[items.indexOf(it)];
        var hWith = hOf(row.length + 1, sum + ar);
        if (hWith <= H) {
          var hWithout = row.length ? hOf(row.length, sum) : Infinity;
          if (row.length && Math.abs(hWithout - H) < Math.abs(hWith - H) && hWithout < H * 1.3) {
            rows.push({ items: row, sum: sum });
            row = [it]; sum = ar;
          } else {
            row.push(it); sum += ar;
            rows.push({ items: row, sum: sum });
            row = []; sum = 0;
          }
        } else { row.push(it); sum += ar; }
      });
      if (row.length) {
        var fill = (sum * H + gap * (row.length - 1)) / W;
        var prevRow = rows[rows.length - 1];
        if (prevRow && fill < .55 && hOf(prevRow.items.length + row.length, prevRow.sum + sum) > H * .55) {
          prevRow.items = prevRow.items.concat(row); prevRow.sum += sum;
        } else rows.push({ items: row, sum: sum, last: fill < .8 });
      }
      rows.forEach(function (r) {
        var h = r.last ? Math.min(H, hOf(r.items.length, r.sum)) : hOf(r.items.length, r.sum);
        r.items.forEach(function (it) {
          var w = Math.floor(ratios[items.indexOf(it)] * h * 100) / 100 - .02;
          it.style.width = w + 'px';
          it.style.height = Math.round(h * 100) / 100 + 'px';
        });
      });
      grid.classList.add('is-js');
    }
    layout();
    if (window.ResizeObserver) {
      var roRaf = 0;
      new ResizeObserver(function () {
        if (roRaf) return;
        roRaf = requestAnimationFrame(function () {
          roRaf = 0;
          var cs = getComputedStyle(grid);
          var W = grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          if (Math.abs(W - lastW) > .5) { layout(); if (!document.body.classList.contains('is-locked')) refresh(); }
        });
      }).observe(grid);
    }

    /* ─── Clip-Reveal beim Scrollen ─────────────────────────────────── */
    var btns = items.map(function (it) { return AK.$('.gl-btn', it); });
    function revealNow(list) {
      list.forEach(function (b) {
        if (b._revealed) return;
        b._revealed = true;
        if (G) { G.killTweensOf(b); G.set(b, { clearProps: 'opacity,visibility,clipPath' }); G.set(AK.$('img', b), { clearProps: 'transform' }); }
      });
    }
    if (AK.motion) {
      G.set(btns, { autoAlpha: 0, clipPath: 'inset(14% 14% 14% 14% round 10px)' });
      ScrollTrigger.batch(btns, {
        start: 'top 92%', once: true,
        onEnter: function (batch) {
          batch = batch.filter(function (b) { return !b._revealed; });
          batch.forEach(function (b) { b._revealed = true; });
          G.to(batch, { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0% round 8px)', duration: 1.25, ease: 'expo.out', stagger: .08,
            clearProps: 'clipPath' });
          G.fromTo(batch.map(function (b) { return AK.$('img', b); }), { scale: 1.28 },
            { scale: 1, duration: 1.6, ease: 'expo.out', stagger: .08, clearProps: 'transform' });
        }
      });
    }

    /* ─── Filter ───────────────────────────────────────────────────── */
    function announce(cat) {
      var chip = chips.filter(function (c) { return c.getAttribute('data-filter') === cat; })[0];
      var n = visible().length;
      var name = chip ? chip.childNodes[0].textContent.trim() : '';
      if (live) live.textContent = n + (n === 1 ? ' Foto' : ' Fotos') + (cat === 'alle' ? '' : ': ' + name);
    }

    function setFilter(cat) {
      if (cat === active) return;
      active = cat;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-filter') === cat ? 'true' : 'false'); });
      AK.track('gallery_filter', { kategorie: cat });

      if (!AK.motion) {
        items.forEach(function (it) { it.hidden = !matches(it, cat); });
        layout(); announce(cat); refresh();
        return;
      }

      // laufende Übergänge beenden und sauberen Zustand herstellen
      if (busy) { busy.kill(); busy = null; }
      G.killTweensOf(items);
      G.set(items, { clearProps: 'transform,opacity,visibility' });

      var before = visible();
      var leaving = before.filter(function (it) { return !matches(it, cat); });
      var staying = before.filter(function (it) { return matches(it, cat); });
      var entering = items.filter(function (it) { return it.hidden && matches(it, cat); });

      function relayout() {
        busy = null;
        var first = staying.map(function (it) { return it.getBoundingClientRect(); });
        leaving.forEach(function (it) { it.hidden = true; G.set(it, { clearProps: 'transform,opacity,visibility' }); });
        entering.forEach(function (it) { it.hidden = false; });
        layout();
        revealNow(entering.map(function (it) { return AK.$('.gl-btn', it); }));

        staying.forEach(function (it, i) {
          var a = first[i], b = it.getBoundingClientRect();
          if (!b.width) return;
          G.fromTo(it, { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: '0 0' },
            { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: .75, ease: 'power3.inOut', clearProps: 'transform' });
        });
        var vh = window.innerHeight;
        var inView = entering.filter(function (it) { var r = it.getBoundingClientRect(); return r.bottom > -50 && r.top < vh + 50; });
        G.fromTo(inView, { autoAlpha: 0, scale: .82, y: 24 },
          { autoAlpha: 1, scale: 1, y: 0, duration: .7, delay: staying.length ? .2 : 0, ease: 'power3.out', stagger: .045,
            clearProps: 'transform,opacity,visibility' });
        announce(cat);
        setTimeout(refresh, 820);
      }

      if (leaving.length) {
        busy = G.to(leaving, { autoAlpha: 0, scale: .9, duration: .28, ease: 'power2.in', stagger: .012, onComplete: relayout });
      } else {
        relayout();
      }
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { setFilter(c.getAttribute('data-filter')); }); });

    /* ─── Lightbox ─────────────────────────────────────────────────── */
    var lb = AK.$('#gl-lightbox');
    if (!lb) return;
    document.body.appendChild(lb);     // außerhalb aller transformierten/clippenden Eltern
    var bg = AK.$('.gl-lb__bg', lb);
    var stage = AK.$('.gl-lb__stage', lb);
    var img = AK.$('.gl-lb__img', lb);
    var elCat = AK.$('.gl-lb__cat', lb);
    var elTitle = AK.$('.gl-lb__title', lb);
    var elCount = AK.$('.gl-lb__count', lb);
    var btnClose = AK.$('.gl-lb__close', lb);
    var btnPrev = AK.$('.gl-lb__nav--prev', lb);
    var btnNext = AK.$('.gl-lb__nav--next', lb);
    var chrome = AK.$$('.gl-lb__top, .gl-lb__nav, .gl-lb__cap', lb);
    var list = [], idx = 0, cur = null, seq = 0, isOpen = false;
    var cache = {};

    function info(it) {
      var t = AK.$('img', it);
      return {
        item: it, thumb: t,
        src: t.currentSrc || t.src, alt: t.alt,
        w: +t.getAttribute('width') || t.naturalWidth || 4, h: +t.getAttribute('height') || t.naturalHeight || 3,
        cat: AK.$('.gl-cat', it).textContent, title: AK.$('.gl-title', it).textContent
      };
    }
    function load(src) {
      if (cache[src]) return cache[src];
      cache[src] = new Promise(function (res) {
        var im = new Image();
        im.onload = im.onerror = function () { res(); };
        im.src = src;
        if (im.decode) im.decode().then(res, res);
      });
      return cache[src];
    }
    function preload() {
      if (list.length < 2) return;
      [1, -1].forEach(function (d) { load(info(list[(idx + d + list.length) % list.length]).src); });
    }
    function setX(x, o) {
      if (G) G.set(img, { x: x, opacity: o == null ? 1 : o });
      else { img.style.transform = 'translateX(' + x + 'px)'; img.style.opacity = o == null ? '' : o; }
    }
    function size() {
      if (!cur) return;
      var r = stage.getBoundingClientRect();
      var padX = r.width < 600 ? 12 : 24, padY = r.height < 500 ? 4 : 12;
      var s = Math.min((r.width - padX * 2) / cur.w, (r.height - padY * 2) / cur.h, 1.25);
      img.style.width = Math.max(40, Math.round(cur.w * s)) + 'px';
      img.style.height = Math.max(30, Math.round(cur.h * s)) + 'px';
    }
    function caption() {
      elCat.textContent = cur.cat;
      elTitle.textContent = cur.title;
      elCount.textContent = (idx + 1) + ' / ' + list.length;
      var single = list.length < 2;
      btnPrev.hidden = single; btnNext.hidden = single;
    }
    function apply() {
      img.src = cur.src;
      img.alt = cur.alt;
      size();
    }

    function open(it) {
      list = visible();
      idx = Math.max(0, list.indexOf(it));
      cur = info(list[idx]);
      isOpen = true;
      lb.hidden = false;
      AK.lock();
      caption(); apply(); preload();
      AK.track('gallery_open', { foto: cur.src.split('/').pop() });

      if (AK.motion) {
        var t = cur.thumb.getBoundingClientRect(), f = img.getBoundingClientRect();
        G.fromTo(bg, { autoAlpha: 0 }, { autoAlpha: 1, duration: .45, ease: 'power2.out' });
        G.fromTo(chrome, { opacity: 0 }, { opacity: 1, duration: .5, delay: .2, ease: 'power2.out' });   // nur Deckkraft: bleibt fokussierbar
        if (f.width && t.width) {
          G.fromTo(img, { x: t.left - f.left, y: t.top - f.top, scale: t.width / f.width, transformOrigin: '0 0', opacity: 1 },
            { x: 0, y: 0, scale: 1, duration: .7, ease: 'expo.out', clearProps: 'transformOrigin' });
        }
      }
      setTimeout(function () { btnClose.focus({ preventScroll: true }); }, 30);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      seq++;
      var it = list[idx];
      var thumbBtn = AK.$('.gl-btn', it);
      function done() {
        lb.hidden = true;
        lb.classList.remove('is-loading');
        if (G) G.set([img, bg].concat(chrome), { clearProps: 'all' });
        img.style.width = img.style.height = '';
        AK.unlock();
        if (thumbBtn) thumbBtn.focus({ preventScroll: true });
      }
      if (!AK.motion) { done(); return; }
      G.killTweensOf(img);
      var t = info(it).thumb.getBoundingClientRect(), f = img.getBoundingClientRect();
      var onScreen = t.width && t.bottom > 0 && t.top < window.innerHeight;
      G.to(chrome, { opacity: 0, duration: .2 });
      G.to(bg, { autoAlpha: 0, duration: .45, delay: .05, ease: 'power2.inOut', onComplete: done });
      if (onScreen && f.width) {
        // aktuellen Versatz (z. B. vom Wischen) einrechnen
        var gx = G.getProperty(img, 'x') || 0;
        G.to(img, { x: gx + t.left - f.left, y: t.top - f.top, scale: t.width / f.width, transformOrigin: '0 0', duration: .5, ease: 'power3.inOut' });
      } else {
        G.to(img, { autoAlpha: 0, scale: .94, duration: .3 });
      }
    }

    function go(dir, fromX) {
      if (list.length < 2) return;
      idx = (idx + dir + list.length) % list.length;
      cur = info(list[idx]);
      var token = ++seq;
      caption(); preload();
      var spin = setTimeout(function () { if (token === seq) lb.classList.add('is-loading'); }, 180);
      function swap() {
        load(cur.src).then(function () {
          if (token !== seq) return;
          clearTimeout(spin); lb.classList.remove('is-loading');
          apply();
          if (AK.motion) G.fromTo(img, { x: dir * 70, opacity: 0, scale: 1 }, { x: 0, opacity: 1, duration: .5, ease: 'power3.out' });
          else setX(0);
        });
      }
      if (AK.motion) {
        G.killTweensOf(img);
        G.fromTo(img, { x: fromX || 0 }, { x: -dir * 70 + (fromX || 0) * .3, opacity: 0, duration: .2, ease: 'power2.in', onComplete: swap });
      } else swap();
    }

    items.forEach(function (it) {
      AK.$('.gl-btn', it).addEventListener('click', function () { open(it); });
    });
    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', function () { go(-1); });
    btnNext.addEventListener('click', function () { go(1); });

    // Klick neben das Bild schließt
    var dragged = false;
    stage.addEventListener('click', function (e) { if (dragged) { dragged = false; return; } if (e.target === stage) close(); });
    AK.$('.gl-lb__cap', lb).addEventListener('click', function (e) { if (e.target === e.currentTarget) close(); });

    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Tab') {
        var f = [btnClose, btnPrev, btnNext].filter(function (b) { return !b.hidden; });
        var i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    window.addEventListener('resize', function () { if (isOpen) size(); }, { passive: true });

    // Wischen (Touch, Stift und Maus-Ziehen)
    var sx = 0, sy = 0, dx = 0, dragging = false, axis = '', pid = null, t0 = 0;
    stage.addEventListener('pointerdown', function (e) {
      if (!isOpen || list.length < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      dragging = true; axis = ''; dx = 0; sx = e.clientX; sy = e.clientY; pid = e.pointerId; t0 = Date.now();
      dragged = false;
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pid) return;
      var mx = e.clientX - sx, my = e.clientY - sy;
      if (!axis) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
        if (axis === 'x') { try { stage.setPointerCapture(pid); } catch (err) {} if (G) G.killTweensOf(img); }
      }
      if (axis !== 'x') return;
      dx = mx; dragged = true;
      setX(dx, 1 - Math.min(.6, Math.abs(dx) / 600));
    });
    function end(e) {
      if (!dragging || (e && e.pointerId !== pid)) return;
      dragging = false;
      if (axis !== 'x') return;
      var fast = Math.abs(dx) > 30 && Date.now() - t0 < 250;
      if (Math.abs(dx) > 70 || fast) go(dx < 0 ? 1 : -1, dx);
      else if (AK.motion) G.to(img, { x: 0, opacity: 1, duration: .35, ease: 'power3.out' });
      else setX(0);
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    img.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // kleine Test-/Steuer-Schnittstelle
    AK.gallery = { open: function (i) { var v = visible(); if (v[i]) open(v[i]); }, close: close, next: function () { go(1); }, prev: function () { go(-1); }, filter: setFilter };
  });
})();

/* ─── 75-reservierung.js ─── */
/* ==========================================================================
   75 – Reservierung
   Funktional identisch zur alten Seite: Google-Sheet (no-cors, fire & forget)
   → mailto an buerstadt.asiakhan@gmail.com → 800 ms später WhatsApp.
   Ruhetag-Prüfung über AK.isRuhetag (Dienstag außer Feiertag / Aktionstag).
   ========================================================================== */
(function () {
  'use strict';

  window.AK.ready(function (AK) {
    var form = AK.$('.reservation-form');
    if (!form) return;

    // ── Google Sheet: URL der bereitgestellten Apps-Script-Web-App ──
    var SHEET_URL = "https://script.google.com/macros/s/AKfycbzQvKmrsfyt-2HrxPyeS1Usfa9mZWij_grMVBqyWr5AkvJcNdCJvcx_Lah-DxzQ69Cwyw/exec";
    var MAIL_TO = 'buerstadt.asiakhan@gmail.com';
    var WA_NR = '491701618887';
    // Russische Live-Musik-Nacht: Hinweis bis einschließlich 27.11.2026 zeigen
    var RN_END = new Date(2026, 10, 28, 0, 0, 0);

    var $ = function (id) { return document.getElementById(id); };
    var nameEl = $('res-name'), telEl = $('res-tel'), dateEl = $('res-date'), timeEl = $('res-time');
    var personsEl = $('res-persons'), countEl = $('res-persons-count'), emailEl = $('res-email');
    var notesEl = $('res-notes'), nlEl = $('res-newsletter');
    var dateMsg = $('res-date-msg'), dateInfo = $('res-date-info');
    var submitBtn = form.querySelector('button[type=submit]');
    var submitLabel = submitBtn && submitBtn.querySelector('.rs-submit__label');
    var waBtn = $('res-wa');
    var done = $('rs-done'), live = $('rs-live');
    var busy = false;

    var fmtLong = null;
    try { fmtLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
    var WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    var MO = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    function longDate(ymd) {
      var d = AK.parseYMD(ymd);
      if (isNaN(d.getTime())) return ymd;
      return fmtLong ? fmtLong.format(d) : WD[d.getDay()] + ', ' + d.getDate() + '. ' + MO[d.getMonth()] + ' ' + d.getFullYear();
    }
    function hhmm(m) { return (m < 600 ? '0' : '') + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60); }

    // Frühestes Datum = heute (Vergangenheit nicht wählbar)
    if (dateEl) dateEl.min = AK.toYMD(new Date());

    // Schreibt die Reservierung zusätzlich in ein Google Sheet.
    // Läuft "fire and forget": Fehler werden geschluckt und blockieren den Nutzer nie.
    function sendToSheet(d) {
      if (!SHEET_URL || SHEET_URL === "HIER_URL_EINFUEGEN") return;
      try {
        fetch(SHEET_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(d),
        }).catch(function () { /* Sheet-Fehler bewusst ignorieren */ });
      } catch (err) { /* Sheet-Fehler bewusst ignorieren */ }
    }

    // Prüft das Datumsfeld live und blockiert das Absenden bei gesperrtem Dienstag
    function checkResDate() {
      if (!dateEl) return true;
      var field = dateEl.closest('.field');
      if (AK.isRuhetag(dateEl.value)) {
        dateEl.setCustomValidity('Dienstag ist Ruhetag – bitte anderen Tag wählen.');
        if (dateMsg) dateMsg.hidden = false;
        if (field) field.classList.add('is-invalid');
        return false;
      }
      dateEl.setCustomValidity('');
      if (dateMsg) dateMsg.hidden = true;
      if (field && dateEl.validity.valid) field.classList.remove('is-invalid');
      return true;
    }
    window.checkResDate = checkResDate;

    // Live-Zeile unter dem Datum: Wochentag, Feiertag / Aktionstag, Öffnungszeiten
    function updateDateInfo() {
      if (!dateInfo) return;
      var v = dateEl.value;
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v) || AK.isRuhetag(v)) { dateInfo.hidden = true; dateInfo.textContent = ''; return; }
      var d = AK.parseYMD(v);
      var hol = AK.holidayName(v), sonder = AK.SONDER_OEFFNUNGSTAGE[v];
      var extra = hol ? hol + (d.getDay() === 2 ? ' – an diesem Feiertag haben wir geöffnet' : '')
        : (sonder ? 'Sonder-Öffnungstag: ' + sonder : '');
      var win = AK.openingWindows(d).map(function (w) { return hhmm(w[0]) + '–' + hhmm(w[1]); });
      dateInfo.textContent = '';
      var wrap = document.createElement('span');
      var b = document.createElement('b'); b.textContent = longDate(v);
      wrap.appendChild(b);
      if (extra) wrap.appendChild(document.createTextNode(' · ' + extra));
      if (win.length) {
        var s = document.createElement('span');
        s.textContent = ' · geöffnet ' + win.join(' & ') + ' Uhr';
        wrap.appendChild(s);
      }
      dateInfo.appendChild(wrap);
      dateInfo.hidden = false;
    }

    // „Mehr als 10 Personen“ → Eingabefeld für die genaue Anzahl
    function togglePersonsCount() {
      var more = personsEl.value === 'more';
      countEl.hidden = !more;
      countEl.required = more;
      if (more) countEl.focus();
      else countEl.value = '';
    }

    function getPersons() {
      var sel = personsEl.value;
      if (sel !== 'more') return sel;
      var n = parseInt(countEl.value, 10);
      return n > 0 ? `${n} Personen` : '';
    }

    function getFormData() {
      return {
        name:    nameEl.value,
        tel:     telEl.value,
        date:    dateEl.value,
        time:    timeEl.value,
        persons: getPersons(),
        email:   emailEl.value,
        notes:   notesEl.value,
        newsletter: nlEl.checked,
      };
    }

    function formatMessage(d) {
      return `🍜 Neue Tischreservierung – Asia Khan\n\n` +
        `👤 Name: ${d.name}\n` +
        `📞 Telefon: ${d.tel}\n` +
        `📅 Datum: ${d.date}\n` +
        `🕐 Uhrzeit: ${d.time} Uhr\n` +
        `👥 Personen: ${d.persons}\n` +
        `📧 E-Mail: ${d.email || '–'}\n` +
        `📝 Anmerkungen: ${d.notes || '–'}`;
    }

    // ── Inline-Validierung (rote Umrandung am betroffenen Feld) ──
    form.addEventListener('invalid', function (e) {
      var f = e.target.closest && e.target.closest('.field');
      if (f) f.classList.add('is-invalid');
    }, true);
    function revalidate(e) {
      var el = e.target, f = el.closest && el.closest('.field');
      if (!f || !f.classList.contains('is-invalid')) return;
      var ok = AK.$$('input, select, textarea', f).every(function (x) { return x.hidden || x.validity.valid; });
      if (ok) f.classList.remove('is-invalid');
    }
    form.addEventListener('input', revalidate);
    form.addEventListener('change', revalidate);

    // Erfolgsbox verschwindet, sobald wieder etwas eingegeben wird
    form.addEventListener('input', function () { if (!busy && done && !done.hidden) done.hidden = true; });

    dateEl.addEventListener('input', function () { checkResDate(); updateDateInfo(); });
    dateEl.addEventListener('change', function () { checkResDate(); updateDateInfo(); });
    personsEl.addEventListener('change', togglePersonsCount);
    // Newsletter abgewählt → E-Mail-Hinweis zurücksetzen
    nlEl.addEventListener('change', function () { if (!nlEl.checked) { emailEl.setCustomValidity(''); revalidate({ target: emailEl }); } });

    function showSuccess(d) {
      busy = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('is-success');
        if (submitLabel) submitLabel.textContent = 'Reservierung gesendet!';
      }
      if (done) {
        $('rs-done-name').textContent = d.name ? ', ' + d.name.trim().split(/\s+/)[0] : '';
        $('rs-done-sum').textContent = longDate(d.date) + ' · ' + d.time + ' Uhr · ' + d.persons;
        done.hidden = false;
      }
      if (live) live.textContent = 'Reservierung gesendet: ' + longDate(d.date) + ', ' + d.time + ' Uhr, ' + d.persons + '.';
      setTimeout(function () {
        if (submitBtn) {
          submitBtn.classList.remove('is-success');
          submitBtn.disabled = false;
          if (submitLabel) submitLabel.textContent = 'Reservierung senden';
        }
        form.reset();
        togglePersonsCount();
        checkResDate();
        updateDateInfo();
        AK.$$('.field.is-invalid', form).forEach(function (f) { f.classList.remove('is-invalid'); });
        if (live) live.textContent = '';
        busy = false;
      }, 4000);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      AK.track('reservation_submit', { personen: personsEl.value });
      if (busy) return;
      var d = getFormData();
      if (!d.name || !d.tel || !d.date || !d.time || !d.persons) return;

      // Ruhetag (Dienstag, kein Feiertag) blockieren
      if (!checkResDate()) {
        dateEl.reportValidity();
        return;
      }

      // Newsletter nur mit E-Mail-Adresse
      if (d.newsletter && !d.email) {
        emailEl.setCustomValidity('Für den Newsletter benötigen wir Ihre E-Mail-Adresse.');
        emailEl.reportValidity();
        emailEl.addEventListener('input', function () { emailEl.setCustomValidity(''); }, { once: true });
        return;
      }

      // Zusätzlich ins Google Sheet schreiben (blockiert Mail/WhatsApp nicht)
      sendToSheet(d);

      var subject = encodeURIComponent(`Tischreservierung – ${d.name} – ${d.date}`);
      var body = encodeURIComponent(formatMessage(d));
      window.open(`mailto:${MAIL_TO}?subject=${subject}&body=${body}`, '_blank');

      // Kurze Pause dann WhatsApp
      setTimeout(function () {
        var msg = encodeURIComponent(formatMessage(d));
        window.open(`https://wa.me/${WA_NR}?text=${msg}`, '_blank');
      }, 800);

      // Bestätigung
      showSuccess(d);
    });

    if (waBtn) waBtn.addEventListener('click', function () {
      AK.track('reservation_whatsapp');
      var d = getFormData();
      // Ruhetag (Dienstag, kein Feiertag) blockieren
      if (d.date && !checkResDate()) {
        dateEl.reportValidity();
        return;
      }
      var msg = encodeURIComponent(
        (d.name || d.tel || d.date)
          ? formatMessage(d)
          : '🍜 Hallo! Ich möchte gerne einen Tisch reservieren.'
      );
      window.open(`https://wa.me/${WA_NR}?text=${msg}`, '_blank');
    });

    // ── Öffnungsstatus in der Info-Karte ──
    var status = $('rs-status');
    function updStatus() {
      if (!status || !AK.openStatus) return;
      var s = AK.openStatus();
      status.classList.toggle('is-open', !!s.open);
      status.querySelector('.rs-status__label').textContent = s.label;
      status.querySelector('.rs-status__detail').textContent = s.detail ? '· ' + s.detail : '';
      status.hidden = false;
    }
    updStatus();
    setInterval(updStatus, 60000);

    // ── Event-Hinweis nach der Veranstaltung ausblenden ──
    var hint = $('rnHint');
    if (hint && new Date() >= RN_END) hint.hidden = true;

    // Falls der Browser Werte wiederherstellt (Zurück-Taste)
    if (dateEl.value) { checkResDate(); updateDateInfo(); }
    if (personsEl.value === 'more') { countEl.hidden = false; countEl.required = true; }
  });
})();

/* ─── 80-kontakt.js ─── */
/* ==========================================================================
   80 · Kontakt
   – Live-Status „Jetzt geöffnet · bis 22:00 Uhr“ (AK.openStatus), minütlich
   – heutiger Tag in der Wochentabelle (Zeit in Bürstadt: AK.nowBerlin)
   – Google-Karte erst nach Klick laden (2-Klick-Lösung)
   ========================================================================== */
(function () {
  'use strict';
  AK.ready(function (AK) {
    var sec = AK.$('#kontakt');
    if (!sec) return;

    /* ─── Öffnungsstatus + heutiger Tag ────────────────────────────── */
    var pill = AK.$('[data-open-status]', sec);
    var txt = pill && AK.$('.kt-status__txt', pill);
    var rows = AK.$$('.kt-week tr[data-day]', sec);

    function markToday(now) {
      var day = now.getDay(), ymd = AK.toYMD(now);
      rows.forEach(function (tr) {
        var on = +tr.getAttribute('data-day') === day;
        tr.classList.toggle('is-today', on);
        var th = tr.querySelector('th'), td = tr.querySelector('td');
        var badge = th.querySelector('.kt-today'), hint = td.querySelector('.kt-hint');
        if (on && !badge) {
          badge = document.createElement('span');
          badge.className = 'kt-today';
          badge.textContent = 'Heute';
          th.appendChild(badge);
        } else if (!on && badge) badge.remove();
        // Feiertag / Aktionstag heute: tatsächliche Öffnung als Hinweis
        var note = '';
        if (on) {
          var hol = AK.holidayName(ymd), extra = AK.SONDER_OEFFNUNGSTAGE && AK.SONDER_OEFFNUNGSTAGE[ymd];
          if (hol) note = hol + ': durchgehend geöffnet';
          else if (extra) note = extra + ': heute geöffnet';
        }
        if (note) {
          if (!hint) { hint = document.createElement('span'); hint.className = 'kt-hint'; td.appendChild(hint); }
          hint.textContent = note;
        } else if (hint) hint.remove();
      });
    }

    function update(now) {
      now = now || (AK.nowBerlin ? AK.nowBerlin() : new Date());
      markToday(now);
      if (!pill) return;
      var s = AK.openStatus(now);
      var t = s.label + (s.detail ? ' · ' + s.detail : '');
      if (txt.textContent !== t) txt.textContent = t;   // nur bei Änderung (aria-live)
      pill.classList.toggle('is-open', !!s.open);
      pill.classList.toggle('is-closed', !s.open);
      pill.hidden = false;
    }
    update();
    // zur nächsten vollen Minute, danach jede Minute
    setTimeout(function () { update(); setInterval(function () { update(); }, 60000); },
      (60 - new Date().getSeconds()) * 1000 + 50);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) update(); });
    AK.kontaktStatus = update;   // z. B. AK.kontaktStatus(new Date(2026, 10, 10, 12, 0)) zum Testen

    /* ─── Karte nach Einwilligung laden ────────────────────────────── */
    var map = AK.$('.kt-map', sec);
    var frame = AK.$('#kt-map-frame', sec);
    var consent = AK.$('#kt-map-consent', sec);
    var loadBtn = AK.$('[data-map-load]', sec);
    function loadMap() {
      if (frame && !frame.getAttribute('src')) frame.src = frame.getAttribute('data-src');
      if (frame) frame.removeAttribute('tabindex');
      map.classList.add('is-loaded');
      AK.track('map_load');
      var finish = function () { if (consent) consent.remove(); if (frame) frame.focus({ preventScroll: true }); };
      if (AK.motion && consent) gsap.to(consent, { autoAlpha: 0, duration: .5, ease: 'power2.out', onComplete: finish });
      else finish();
    }
    if (loadBtn) loadBtn.addEventListener('click', loadMap);
    window.loadMap = window.loadMap || loadMap;   // Kompatibilität zum alten Seiten-Skript
  });
})();

/* ─── 90-footer.js ─── */
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

/* ─── 95-overlays.js ─── */
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
