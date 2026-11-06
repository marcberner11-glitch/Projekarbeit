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
      return appeared;
    }

    function animateIn(els, stagger) {
      if (!AK.motion || !els.length) return;
      gsap.fromTo(els, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .5, ease: 'power3.out', stagger: stagger || .04, overwrite: true, clearProps: 'transform,opacity,visibility' });
    }

    // Wenn die Werkzeugleiste klebt, nach dem Filtern zum Anfang der Ergebnisse springen.
    // Beim Hochscrollen blendet sich die Navigation wieder ein → deren Höhe einrechnen.
    function keepInView() {
      if (!tools) return;
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
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); keepInView(); }
      });
    }
    if (clear) clear.addEventListener('click', function () { input.value = ''; animateIn(apply(), .02); input.focus(); });
    if (btnAll) btnAll.addEventListener('click', function () { setChip('alle'); });
    if (btnReset) btnReset.addEventListener('click', function () { if (input) input.value = ''; setChip('alle'); });

    apply();
  });
})();
