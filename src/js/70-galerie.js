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
