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

    var now = new Date();
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
