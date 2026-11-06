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
