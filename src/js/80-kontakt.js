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
