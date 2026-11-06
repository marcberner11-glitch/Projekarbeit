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
