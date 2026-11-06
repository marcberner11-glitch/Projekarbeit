/* Reservierungs-System & Overlays – End-to-End-Test
 *
 *   node build.mjs && node tests/reservierung.test.cjs
 *
 * Startet einen eigenen statischen Server (Repo-Root, freier Port) –
 * oder nutzt BASE_URL (z. B. BASE_URL=http://localhost:8080/).
 * Der POST an das Google-Sheet wird per page.route abgefangen (es geht
 * nichts ins Netz), window.open wird gestubbt und protokolliert.
 */
'use strict';
process.env.TZ = 'Europe/Berlin'; // Node und Browser rechnen in derselben Zeitzone

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzQvKmrsfyt-2HrxPyeS1Usfa9mZWij_grMVBqyWr5AkvJcNdCJvcx_Lah-DxzQ69Cwyw/exec';
const KEYS = ['name', 'tel', 'date', 'time', 'persons', 'email', 'notes', 'newsletter'];
const HELLO = '🍜 Hallo! Ich möchte gerne einen Tisch reservieren.';
const RUHETAG_TXT = 'Dienstag ist Ruhetag – an diesem Tag können wir leider keine Reservierung annehmen. Bitte wählen Sie einen anderen Tag.';

// Erwartete Nachricht – bewusst unabhängig vom Seiten-Code nachgebaut (Original-Vorlage)
function expectedMessage(d) {
  return '🍜 Neue Tischreservierung – Asia Khan\n\n' +
    '👤 Name: ' + d.name + '\n' +
    '📞 Telefon: ' + d.tel + '\n' +
    '📅 Datum: ' + d.date + '\n' +
    '🕐 Uhrzeit: ' + d.time + ' Uhr\n' +
    '👥 Personen: ' + d.persons + '\n' +
    '📧 E-Mail: ' + (d.email || '–') + '\n' +
    '📝 Anmerkungen: ' + (d.notes || '–');
}

/* ─── Mini-Testrahmen ──────────────────────────────────────────────── */
const results = [];
let current = '';
function check(cond, msg, extra) {
  results.push({ test: current, ok: !!cond, msg });
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && extra !== undefined ? '  → ' + JSON.stringify(extra) : ''}`);
}
function info(errors) {
  if (errors.length) console.log('  INFO  JS-Fehler auf der Seite (evtl. aus anderen Abschnitten): ' + JSON.stringify(errors.slice(0, 3)));
  else console.log('  INFO  keine JS-Fehler');
}
function eq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(ok, msg, ok ? undefined : { actual, expected });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─── Statischer Server ────────────────────────────────────────────── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon' };
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* ─── Seite vorbereiten ────────────────────────────────────────────── */
let browser, BASE;
async function openPage(opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 900 },
    timezoneId: 'Europe/Berlin', locale: 'de-DE',
    reducedMotion: opts.motion ? 'no-preference' : 'reduce',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && /^\[AK\]/.test(m.text())) errors.push(m.text()); });
  if (opts.time) await page.clock.setFixedTime(opts.time);
  await page.addInitScript((markSeen) => {
    window.__opened = [];
    window.open = function (url, target) { window.__opened.push({ url: String(url), target: target, t: performance.now() }); return null; };
    if (markSeen) { try { sessionStorage.setItem('rnSeen', '1'); } catch (e) {} }
  }, opts.popup ? false : true);
  const sheet = [];
  await page.route(SHEET_URL + '**', async (route) => {
    const r = route.request();
    sheet.push({ method: r.method(), headers: r.headers(), body: r.postData() });
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
  });
  // keine echten Fremd-Requests (z. B. Karten) im Test
  const origin = new URL(BASE).origin;
  await page.route((u) => u.origin !== origin && !u.href.startsWith(SHEET_URL), (route) => route.abort());
  await page.goto(BASE, { waitUntil: opts.waitUntil || 'load' });
  return { ctx, page, sheet, errors };
}

async function fillForm(page, d) {
  if (d.name !== undefined) await page.fill('#res-name', d.name);
  if (d.tel !== undefined) await page.fill('#res-tel', d.tel);
  if (d.date !== undefined) await page.fill('#res-date', d.date);
  if (d.time !== undefined) await page.selectOption('#res-time', d.time);
  if (d.persons !== undefined) await page.selectOption('#res-persons', d.persons);
  if (d.count !== undefined) await page.fill('#res-persons-count', String(d.count));
  if (d.email !== undefined) await page.fill('#res-email', d.email);
  if (d.notes !== undefined) await page.fill('#res-notes', d.notes);
  if (d.newsletter) await page.check('#res-newsletter');
}
const opened = (page) => page.evaluate(() => window.__opened.slice());
function parseMailto(url) {
  const [addr, q] = url.split('?');
  const params = {};
  (q || '').split('&').forEach((kv) => { const i = kv.indexOf('='); params[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
  return { addr, params };
}
function waText(url) {
  const m = url.match(/^https:\/\/wa\.me\/491701618887\?text=(.*)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/* ─── Tests ────────────────────────────────────────────────────────── */
const NOW = '2026-11-06T12:00:00';

const tests = {
  async '1 · Normale Reservierung: Sheet-POST, mailto, danach WhatsApp'() {
    const { ctx, page, sheet, errors } = await openPage({ time: NOW });
    const d = { name: 'Max Mustermann', tel: '0170 1234567', date: '2026-11-27', time: '18:30', persons: '4 Personen', email: 'max@example.de', notes: 'Fensterplatz bitte' };
    eq(await page.$eval('#res-date', (e) => e.min), '2026-11-06', 'Datumsfeld: min = heute');
    await fillForm(page, d);
    eq((await page.textContent('#res-date-info')).trim(), 'Freitag, 27. November 2026 · geöffnet 11:30–15:00 & 17:30–22:00 Uhr', 'Live-Zeile zeigt Wochentag + Öffnungszeiten');
    await page.click('#res-submit');
    await sleep(1300);

    eq(sheet.length, 1, 'genau ein POST an das Google Sheet');
    const req = sheet[0] || { headers: {}, body: '{}' };
    eq(req.method, 'POST', 'Methode POST');
    eq(req.headers['content-type'], 'text/plain;charset=utf-8', 'Content-Type text/plain;charset=utf-8');
    const json = JSON.parse(req.body || '{}');
    eq(Object.keys(json), KEYS, 'JSON hat genau die 8 Schlüssel in Original-Reihenfolge');
    eq(json, { name: d.name, tel: d.tel, date: '2026-11-27', time: '18:30', persons: '4 Personen', email: d.email, notes: d.notes, newsletter: false }, 'JSON-Werte korrekt (Formate wie Original)');

    const o = await opened(page);
    eq(o.length, 2, 'zwei Fenster geöffnet (mailto + WhatsApp)');
    const mail = parseMailto((o[0] || {}).url || '');
    eq(mail.addr, 'mailto:buerstadt.asiakhan@gmail.com', '1. Fenster: mailto an buerstadt.asiakhan@gmail.com');
    eq(mail.params.subject, 'Tischreservierung – Max Mustermann – 2026-11-27', 'Betreff korrekt');
    eq(mail.params.body, expectedMessage(json), 'Mail-Text = Original-Vorlage');
    eq((o[0] || {}).target, '_blank', 'mailto in neuem Fenster');
    eq(waText((o[1] || {}).url || ''), expectedMessage(json), '2. Fenster: wa.me/491701618887 mit gleicher Nachricht');
    const dt = o[1] && o[0] ? o[1].t - o[0].t : 0;
    check(dt >= 750 && dt < 1500, `WhatsApp ca. 800 ms nach mailto (${Math.round(dt)} ms)`);

    const layer = await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'reservation_submit'));
    eq(layer.map((e) => e.personen), ['4 Personen'], "AK.track('reservation_submit', {personen})");
    check(/Reservierung gesendet!/.test(await page.textContent('#res-submit')), 'Button zeigt „Reservierung gesendet!“');
    check(await page.$eval('#res-submit', (b) => b.disabled), 'Button während der Bestätigung deaktiviert');
    check(await page.isVisible('#rs-done'), 'Erfolgs-Zusammenfassung sichtbar');
    eq((await page.textContent('#rs-done-sum')).trim(), 'Freitag, 27. November 2026 · 18:30 Uhr · 4 Personen', 'Zusammenfassung korrekt');
    await sleep(3200); // 4 s nach dem Absenden
    eq(await page.inputValue('#res-name'), '', 'nach 4 s: Formular zurückgesetzt');
    check(/Reservierung senden/.test(await page.textContent('#res-submit')) && !(await page.$eval('#res-submit', (b) => b.disabled)), 'nach 4 s: Button wieder „Reservierung senden“');
    info(errors);
    await ctx.close();
  },

  async '2 · Pflichtfelder & Dienstag (Ruhetag) blockieren'() {
    const { ctx, page, sheet } = await openPage({ time: NOW });
    await page.click('#res-submit');
    await sleep(400);
    eq(sheet.length + (await opened(page)).length, 0, 'leeres Formular: nichts gesendet');

    await fillForm(page, { name: 'Erika Muster', tel: '06206 123', date: '2026-11-10', time: '12:00', persons: '2 Personen' });
    check(await page.isVisible('#res-date-msg'), 'Ruhetag-Hinweis sichtbar');
    check((await page.textContent('#res-date-msg')).replace(/\s+/g, ' ').includes(RUHETAG_TXT), 'Hinweistext wörtlich wie Original');
    eq(await page.$eval('#res-date', (e) => e.validationMessage), 'Dienstag ist Ruhetag – bitte anderen Tag wählen.', 'setCustomValidity am Datum gesetzt');
    await page.click('#res-submit');
    await sleep(1200);
    eq(sheet.length, 0, 'Dienstag 10.11.2026: kein Sheet-POST');
    eq((await opened(page)).length, 0, 'Dienstag 10.11.2026: kein mailto / WhatsApp');

    await page.fill('#res-date', '2026-11-11');
    check(!(await page.isVisible('#res-date-msg')), 'Mittwoch gewählt: Hinweis verschwindet');
    eq(await page.$eval('#res-date', (e) => e.validationMessage), '', 'Mittwoch: Datum wieder gültig');
    await ctx.close();
  },

  async '3 · Dienstag-Feiertag (03.10.2028) und Sonder-Öffnungstag (11.08.2026) erlaubt'() {
    let { ctx, page, sheet } = await openPage({ time: NOW });
    await fillForm(page, { name: 'Feier Tag', tel: '0151 999', date: '2028-10-03', time: '13:00', persons: '6 Personen' });
    check(!(await page.isVisible('#res-date-msg')), '03.10.2028 (Di, Tag der Deutschen Einheit): kein Ruhetag-Hinweis');
    check((await page.textContent('#res-date-info')).includes('Tag der Deutschen Einheit'), 'Live-Zeile nennt den Feiertag');
    await page.click('#res-submit');
    await sleep(1100);
    eq(sheet.length && JSON.parse(sheet[0].body).date, '2028-10-03', '03.10.2028: Reservierung gesendet');
    eq((await opened(page)).length, 2, '03.10.2028: mailto + WhatsApp geöffnet');

    // Ehrlich: mit dem echten Datum (06.11.2026) blockiert min=heute den vergangenen 11.08.2026
    await sleep(3400);
    await fillForm(page, { name: 'Back To School', tel: '0151 111', date: '2026-08-11', time: '12:00', persons: '3 Personen' });
    check(!(await page.isVisible('#res-date-msg')), '11.08.2026 ist kein Ruhetag (Sonder-Öffnungstag)');
    check(await page.$eval('#res-date', (e) => e.validity.rangeUnderflow), 'am 06.11.2026 ist der 11.08.2026 Vergangenheit → min blockiert');
    await ctx.close();

    // Uhr auf den 01.08.2026 stellen → der Aktionstag liegt in der Zukunft
    ({ ctx, page, sheet } = await openPage({ time: '2026-08-01T10:00:00' }));
    eq(await page.$eval('#res-date', (e) => e.min), '2026-08-01', 'Uhr 01.08.2026: min = 2026-08-01');
    await fillForm(page, { name: 'Back To School', tel: '0151 111', date: '2026-08-11', time: '12:00', persons: '3 Personen' });
    check(!(await page.isVisible('#res-date-msg')), '11.08.2026 (Di, Back to School): kein Ruhetag-Hinweis');
    check((await page.textContent('#res-date-info')).includes('Back to School'), 'Live-Zeile nennt den Aktionstag');
    await page.click('#res-submit');
    await sleep(1100);
    eq(sheet.length && JSON.parse(sheet[0].body).date, '2026-08-11', '11.08.2026: Reservierung gesendet');
    await ctx.close();
  },

  async '4 · Mehr als 10 Personen → genaue Anzahl Pflicht, sendet „14 Personen“'() {
    const { ctx, page, sheet } = await openPage({ time: NOW });
    check(!(await page.isVisible('#res-persons-count')), 'Anzahl-Feld zunächst versteckt');
    await fillForm(page, { name: 'Große Runde', tel: '0170 5555', date: '2026-11-13', time: '19:00', persons: 'more' });
    check(await page.isVisible('#res-persons-count'), '„Mehr als 10 Personen“ zeigt das Anzahl-Feld');
    check(await page.$eval('#res-persons-count', (e) => e.required && e.min === '11' && e.max === '200'), 'Anzahl-Feld: required, min 11, max 200');
    await page.click('#res-submit');
    await sleep(500);
    eq(sheet.length, 0, 'ohne Anzahl: nichts gesendet');
    await page.fill('#res-persons-count', '5');
    await page.click('#res-submit');
    await sleep(500);
    eq(sheet.length, 0, 'Anzahl 5 (< 11): nichts gesendet');
    await page.fill('#res-persons-count', '14');
    await page.click('#res-submit');
    await sleep(1100);
    eq(sheet.length && JSON.parse(sheet[0].body).persons, '14 Personen', 'gesendet: persons = „14 Personen“');
    const o = await opened(page);
    check(o[1] && waText(o[1].url).includes('👥 Personen: 14 Personen'), 'WhatsApp-Text enthält „14 Personen“');
    const layer = await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'reservation_submit').map((e) => e.personen));
    check(layer.includes('more'), "Tracking personen = Select-Wert ('more') wie im Original");
    await sleep(3200);
    check(!(await page.isVisible('#res-persons-count')) && (await page.inputValue('#res-persons-count')) === '', 'nach Reset: Anzahl-Feld wieder versteckt und leer');
    // 1 Person (Singular)
    await page.selectOption('#res-persons', '1 Person');
    await fillForm(page, { name: 'Solo', tel: '0170 1', date: '2026-11-13', time: '11:30' });
    await page.click('#res-submit');
    await sleep(400);
    eq(sheet.length > 1 && JSON.parse(sheet[1].body).persons, '1 Person', '„1 Person“ wird unverändert gesendet');
    await ctx.close();
  },

  async '5 · Newsletter ohne E-Mail wird blockiert'() {
    const { ctx, page, sheet } = await openPage({ time: NOW });
    await fillForm(page, { name: 'News Letter', tel: '0170 222', date: '2026-11-14', time: '20:00', persons: '2 Personen', newsletter: true });
    await page.click('#res-submit');
    await sleep(800);
    eq(sheet.length + (await opened(page)).length, 0, 'Newsletter ohne E-Mail: nichts gesendet');
    eq(await page.$eval('#res-email', (e) => e.validationMessage), 'Für den Newsletter benötigen wir Ihre E-Mail-Adresse.', 'Hinweis „Für den Newsletter benötigen wir Ihre E-Mail-Adresse.“');
    await page.fill('#res-email', 'news@example.de');
    eq(await page.$eval('#res-email', (e) => e.validationMessage), '', 'nach Eingabe: Hinweis entfernt');
    await page.click('#res-submit');
    await sleep(1100);
    const j = sheet.length ? JSON.parse(sheet[0].body) : {};
    eq([j.email, j.newsletter], ['news@example.de', true], 'mit E-Mail: gesendet, newsletter = true');
    check(await page.isVisible('a[href="datenschutz.html#newsletter"]') && await page.isVisible('a[href="datenschutz.html#reservierung"]'), 'Datenschutz-Links vorhanden');
    await ctx.close();
  },

  async '6 · Nur „Via WhatsApp senden“'() {
    const { ctx, page, sheet } = await openPage({ time: NOW });
    await page.click('#res-wa');
    let o = await opened(page);
    eq(o.length === 1 && waText(o[0].url), HELLO, 'leeres Formular: Begrüßungstext an wa.me/491701618887');
    eq(o[0] && o[0].target, '_blank', 'WhatsApp in neuem Fenster');
    await fillForm(page, { name: 'Wa Nutzer', date: '2026-11-20' });
    await page.click('#res-wa');
    o = await opened(page);
    eq(o.length === 2 && waText(o[1].url), expectedMessage({ name: 'Wa Nutzer', tel: '', date: '2026-11-20', time: '', persons: '', email: '', notes: '' }), 'teilweise ausgefüllt: formatMessage(d)');
    await page.fill('#res-date', '2026-11-17');
    await page.click('#res-wa');
    await sleep(300);
    eq((await opened(page)).length, 2, 'Dienstag 17.11.2026: WhatsApp blockiert');
    check(await page.isVisible('#res-date-msg'), 'Ruhetag-Hinweis sichtbar');
    eq(sheet.length, 0, 'WhatsApp-Button schreibt nicht ins Sheet');
    const n = await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'reservation_whatsapp').length);
    eq(n, 3, "AK.track('reservation_whatsapp') bei jedem Klick");
    await ctx.close();
  },

  async '7 · Event-Hinweis & Popup bis 27.11.2026, ab 28.11.2026 aus'() {
    // a) Vor dem Event (mit Animationen)
    let { ctx, page, errors } = await openPage({ time: '2026-11-27T20:00:00', popup: true, motion: true, waitUntil: 'domcontentloaded' });
    eq(await page.$eval('#rnHint', (e) => !e.hidden && getComputedStyle(e).display !== 'none'), true, '27.11.2026 20:00: Hinweis-Karte sichtbar');
    await sleep(300);
    check(!(await page.isVisible('#rnPopup')), 'Popup erscheint nicht sofort');
    await sleep(1400);
    check(await page.isVisible('#rnPopup'), 'Popup nach 1,2 s sichtbar');
    eq(await page.$eval('#rnPopup', (e) => [e.getAttribute('role'), e.getAttribute('aria-modal'), e.getAttribute('aria-labelledby')]), ['dialog', 'true', 'rnTitle'], 'role="dialog", aria-modal, aria-labelledby');
    const txt = (await page.textContent('#rnPopup')).replace(/\s+/g, ' ');
    ['Begrenzte', 'Мест мало!', 'Пятница', '27.11.2026', 'Russische Live-Musik-Nacht', 'Русская музыкальная ночь', '俄罗斯音乐之夜',
      'Einlass & Sekt', 'Live: TriBit', 'Vorverkauf', 'Вход и игристое', 'Живая музыка', 'Предпродажа',
      '50 € im Vorverkauf (Ticket bis 20.11. bei uns abholen) · Abendkasse 55 € · Kinder ermäßigt, unter 3 J. frei',
      '400+ Songs – Repertoire der Band ansehen', 'Jetzt Plätze reservieren', 'Забронировать места', 'Vielleicht später']
      .forEach((t) => check(txt.includes(t), 'Popup-Text: ' + t));
    eq(await page.$eval('#rnPopup img', (e) => e.alt), 'Die Band TriBit: Willi (Saxophon), Viktoria (Gesang) und Shukhrat (E-Gitarre)', 'Band-Bild mit Original-Alt-Text');
    check(await page.$('#rnPopup a[href="russische-nacht.html#repertoire"]') && await page.$('#rnPopup a[href="russische-nacht.html#reservieren"]'), 'Links zu Repertoire & Reservieren');
    check(await page.evaluate(() => document.body.classList.contains('is-locked')), 'Seite hinter dem Popup gesperrt');
    await page.keyboard.press('Escape');
    await sleep(200);
    check(!(await page.isVisible('#rnPopup')), 'Esc schließt das Popup');
    eq(await page.evaluate(() => sessionStorage.getItem('rnSeen')), '1', "sessionStorage 'rnSeen' = '1'");
    check(await page.evaluate(() => !document.getElementById('rnPopup').contains(document.activeElement)), 'Fokus zurückgegeben');
    await page.reload({ waitUntil: 'load' });
    await sleep(1700);
    check(!(await page.isVisible('#rnPopup')), 'nur einmal pro Sitzung (nach Reload kein Popup)');
    info(errors);
    await ctx.close();

    // b) Hintergrund-Klick schließt
    ({ ctx, page } = await openPage({ time: '2026-11-20T12:00:00', popup: true }));
    await sleep(1600);
    check(await page.isVisible('#rnPopup'), '20.11.2026: Popup sichtbar');
    await page.mouse.click(8, 8);
    await sleep(200);
    check(!(await page.isVisible('#rnPopup')), 'Klick auf den Hintergrund schließt');
    await ctx.close();

    // c) Ab 28.11.2026 00:00
    ({ ctx, page } = await openPage({ time: '2026-11-28T00:00:00', popup: true }));
    eq(await page.$eval('#rnHint', (e) => e.hidden || getComputedStyle(e).display === 'none'), true, '28.11.2026 00:00: Hinweis-Karte ausgeblendet');
    await sleep(1700);
    check(!(await page.isVisible('#rnPopup')), '28.11.2026 00:00: kein Popup');
    await ctx.close();

    // d) Letzte Minute davor
    ({ ctx, page } = await openPage({ time: '2026-11-27T23:59:00', popup: true }));
    eq(await page.$eval('#rnHint', (e) => !e.hidden), true, '27.11.2026 23:59: Hinweis-Karte noch sichtbar');
    await ctx.close();
  },

  async '8 · Mobile Aktionsleiste'() {
    const { ctx, page } = await openPage({ time: NOW, viewport: { width: 390, height: 844 } });
    const bar = 'nav.mobile-cta';
    check(await page.isVisible(bar), '390 px: Leiste sichtbar');
    eq(await page.$$eval(bar + ' a', (as) => as.map((a) => a.getAttribute('href'))), ['tel:+4962069518988', '#reservierung',
      'https://www.google.com/maps/dir/?api=1&destination=Asia+Khan+Asiatisches+Restaurant,+Lampertheimer+Str.+21,+68642+B%C3%BCrstadt'], 'Anrufen · Reservieren · Route (Original-Links)');
    const pb = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
    check(pb >= 60, `body padding-bottom auf Phones (${pb}px)`);
    await page.evaluate(() => document.getElementById('res-name').scrollIntoView({ block: 'center' }));
    await sleep(700);
    check(!(await page.isVisible(bar)), 'Formular im Blick: Leiste ausgeblendet');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(700);
    check(await page.isVisible(bar), 'oben wieder sichtbar');
    await page.evaluate(() => window.AK.modal.open('rnPopup'));
    await sleep(800);
    check(!(await page.isVisible(bar)), 'Overlay offen: Leiste ausgeblendet');
    await page.evaluate(() => window.AK.modal.close('rnPopup'));
    await sleep(600);
    check(await page.isVisible(bar), 'Overlay zu: Leiste wieder sichtbar');
    const ow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    eq(ow, 0, 'kein horizontaler Überlauf bei 390 px');
    await ctx.close();
    const d = await openPage({ time: NOW });
    check(!(await d.page.isVisible(bar)), '1280 px: Leiste ausgeblendet');
    await d.ctx.close();
  },
};

(async () => {
  let srv = null;
  if (process.env.BASE_URL) BASE = process.env.BASE_URL;
  else { srv = await startServer(); BASE = `http://127.0.0.1:${srv.address().port}/`; }
  console.log('Reservierungs-Test gegen ' + BASE + '\n');
  browser = await chromium.launch();
  for (const [name, fn] of Object.entries(tests)) {
    current = name;
    console.log(name);
    try { await fn(); } catch (e) { check(false, 'Ausnahme: ' + (e && e.message ? e.message.split('\n')[0] : e)); }
    console.log('');
  }
  await browser.close();
  if (srv) srv.close();

  const failed = results.filter((r) => !r.ok);
  console.log('──────────────────────────────────────────────');
  const byTest = {};
  results.forEach((r) => { byTest[r.test] = byTest[r.test] || { ok: 0, fail: 0 }; byTest[r.test][r.ok ? 'ok' : 'fail']++; });
  Object.entries(byTest).forEach(([t, c]) => console.log(`${c.fail ? 'FAIL' : 'PASS'}  ${t}  (${c.ok}/${c.ok + c.fail})`));
  console.log('──────────────────────────────────────────────');
  console.log(failed.length ? `FAIL – ${failed.length} von ${results.length} Prüfungen fehlgeschlagen` : `PASS – alle ${results.length} Prüfungen bestanden`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
