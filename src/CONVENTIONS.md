# Bausteine & Konventionen (für alle Abschnitte)

The page is assembled by `node build.mjs` from:

- `src/partials/NN-name.html` → concatenated (sorted by filename) into `index.html`
- `src/css/NN-name.css` → `css/style.css`
- `src/js/NN-name.js` → `js/app.js` (loaded with `defer` after `js/gsap.min.js` + `js/ScrollTrigger.min.js`)

Each section owns exactly one partial, and optionally one CSS file and one JS file with the **same NN prefix**.
Never edit another section's files or the generated `index.html`, `css/style.css` or `js/app.js`.

| NN | file | owner |
|----|------|-------|
| 00 | head (SEO, JSON-LD, icon sprite), core CSS/JS | main |
| 10 | nav + mobile menu | main |
| 20 | hero (Blender lantern loop) | main |
| 25 | quick-info strip | main |
| 30 | über uns + Blender gate scroll sequence | main |
| 35 | video | main |
| 40 | buffet & preise | agent A |
| 45 | speisekarte | agent A |
| 50 | events (Feiern) | agent B |
| 55 | familien / kinder | agent B |
| 60 | außer Haus: partyservice + to go | agent B |
| 65 | bewertungen | agent C |
| 70 | galerie + lightbox | agent C |
| 75 | reservierung | agent D |
| 80 | kontakt & öffnungszeiten & anreise & karte | agent C |
| 85 | faq | agent C |
| 89 | `</main>` | main |
| 90 | footer | agent C |
| 95 | overlays: event popup, mobile action bar | agent D |
| 99 | closing tags | main |

## HTML rules
- One `<section id="…" class="sec">` per partial (keep the original ids: `ueber`, `buffet`, `speisekarte`, `events`, `kinder`, `partyservice`, `togo`, `bewertungen`, `galerie`, `reservierung`, `kontakt`, `faq`; `footer` element for the footer). Content inside `<div class="wrap">`.
- Section header pattern:
  ```html
  <header class="sec-head">
    <span class="kicker" data-reveal="fade"><span class="cn">美食</span> Unsere Hauptattraktion</span>
    <h2 class="sec-title" data-split>All you can eat <em>&amp; All you can drink</em></h2>
    <p class="lead" data-reveal>…</p>
  </header>
  ```
- **Chinese characters**: the self-hosted Noto Serif SC font is subset. Use only characters from this set:
  临 之 乐 价 俄 儿 前 包 卖 司 味 外 夜 客 宴 寿 带 打 斯 时 来 汤 海 炒 牛 猪 目 童 素 罗 美 肉 节 菜 订 豪 道 配 队 面 音 预 食 饭 鲜 鸡 鸭
  (useful words: 豪客来 brand · 美食 gourmet food · 价目 price list · 菜 dishes · 汤 soup · 前菜 starters · 炒饭面 fried rice/noodles · 猪肉 · 牛肉 · 鸡肉 · 鸭 · 海鲜 · 素菜 · 寿司 · 儿童 · 配菜 · 外卖 delivery · 打包 / 外带 take-away · 宴 banquet · 音乐 music · 预订 reservation · 道 way)
- No inline `style="…"` attributes except truly one-off values; put styles in your CSS file. No emojis as primary icons — use the SVG sprite icons: `<svg class="ico" aria-hidden="true"><use href="#i-phone"/></svg>`.
  Available icon ids: `i-phone i-whatsapp i-pin i-clock i-calendar i-users i-mail i-car i-parking i-train i-star i-star-o i-check i-chevron-down i-chevron-left i-chevron-right i-x i-menu i-gift i-cake i-utensils i-flame i-fish i-baby i-music i-sparkle i-box i-truck i-leaf i-arrow-right i-arrow-up-right i-heart i-building i-rings i-party i-sun i-moon i-info i-nav i-instagram i-facebook i-search i-play i-access i-ticket i-drink i-bowl i-lantern`.
  Icon in a round gold badge: `<span class="ico-badge"><svg class="ico"><use href="#i-flame"/></svg></span>`.
- Images: `<img src="images/x.jpg" alt="…" width="1200" height="1600" loading="lazy" decoding="async">` (real pixel sizes are listed below). Wrap in `.media` (rounded, cover). Add class `kb` to the `.media` wrapper for a scroll-driven cinematic dolly-in (“Higgsfield-style” camera move).
- Links: phone `tel:+4962069518988` (shown as `06206 951 8988`), second phone `tel:+4962069510475` (`06206 951 0475`), WhatsApp `https://wa.me/491701618887`, To-Go phone `tel:+496206950440`. External links: `target="_blank" rel="noopener"`.
- Accessibility: real `<button>`s for actions, `aria-label` on icon-only buttons, headings in order (h2 per section, h3 inside), visible focus. German texts, keep all original wording/prices exactly.

## CSS rules
- Use the tokens from `src/css/00-base.css` (`--ink`, `--ink-2`, `--ink-3`, `--lacquer`, `--gold`, `--gold-2`, `--gold-3`, `--text`, `--muted`, `--faint`, `--line`, `--line-2`, `--radius`, `--ease`, fonts `--f-display`, `--f-label`, `--f-cn`). Prefix your classes with a section prefix (e.g. `.bf-` buffet, `.mk-` menu, `.ev-` events, `.kd-` kinder, `.ah-` außer Haus, `.rv-` reviews, `.gl-` gallery, `.rs-` reservation, `.kt-` kontakt, `.fq-` faq, `.ft-` footer, `.ov-` overlays).
- Existing components to reuse: `.wrap`, `.wrap--narrow`, `.sec`, `.sec--raised`, `.sec--glow`, `.grid-2/3/4`, `.grid-auto`, `.sec-head`, `.kicker`, `.sec-title`, `.lead`, `.title-l/m/s`, `.muted`, `.faint`, `.gold`, `.small`, `.tiny`, `.label`, `.btn` + `.btn--gold | --red | --ghost | --wa | --sm | --block`, `.btn-row`, `.link-arrow`, `.card` + `.card--hover | --feature | --flat`, `.badge` + `--red | --solid`, `.checks` (tick list), `.tabs` + `.tab`, `.tabs-center`, `.tab-panel`, `.chips` + `.chip`, `.media` + `--frame | --shade` + `.ratio-4x3/3x4/16x9/1`, `.field` (label + input/select/textarea), `.modal` + `.modal__box` + `.modal__close`, `.divider`, `.shine-line`, `.ico`, `.ico-badge`.
- Must work from 320 px to 1920 px wide: no horizontal scrolling, tap targets ≥ 44 px, 16 px minimum side gutter on phones (the `.wrap` already does this).
- Respect `prefers-reduced-motion` (base CSS already neutralises CSS animations; wrap your own keyframe loops in `@media (prefers-reduced-motion: no-preference)` if they are large).

## JS rules
- Wrap everything in an IIFE and register with `AK.ready(function (AK) { … })`. It runs on DOMContentLoaded **before** the generic animations are initialised.
- `AK.motion` is `true` when GSAP is loaded and the user allows motion — guard every GSAP call with it. `gsap` and `ScrollTrigger` are globals (already registered).
- Generic, attribute-driven animations (no JS needed in your file):
  - `data-reveal="up|down|left|right|fade|scale|blur|clip"` (+ `data-delay="0.2"`) – fade/slide in when scrolled into view (`clip` = cinematic image reveal).
  - `data-stagger="0.08"` on a container – its direct children appear one after another.
  - `data-split` on a heading – words rise out of a mask.
  - `data-parallax="0.15"` – element drifts with scroll.
  - `.kb` on a `.media` wrapper – dolly-in camera move on the image.
  - `data-count="74" data-suffix="+"` – number counts up.
  - Tabs: `.tabs[data-tabs][role=tablist] > button.tab[role=tab][aria-selected][aria-controls]`, panels `.tab-panel[role=tabpanel][id]`, inactive panels have `hidden`. Switching is handled by core (and animates the panel). Listen to `ak:tab` on the tablist if needed.
  - Modals: `<div class="modal" id="x" role="dialog" aria-modal="true" aria-labelledby="x-title" hidden><div class="modal__box"><button class="modal__close" data-modal-close aria-label="Schließen"><svg class="ico"><use href="#i-x"/></svg></button>…</div></div>`; open with `data-modal-open="x"` or `AK.modal.open('x')`, close with `AK.modal.close('x')`. Esc/backdrop/focus handled.
  - Accordion: `<details class="acc"><summary>…</summary><div class="acc__body">…</div></details>` animates automatically.
  - Tracking: `AK.track('event_name', {props})`; `data-track="name"` on a link/button tracks clicks.
- Opening hours / holidays (single source of truth, use these instead of re-implementing): `AK.isRuhetag('YYYY-MM-DD')` (Tuesday & not a Hessian public holiday & not in `AK.SONDER_OEFFNUNGSTAGE`), `AK.isHoliday(ymd)`, `AK.holidayName(ymd)`, `AK.SONDER_OEFFNUNGSTAGE` (object, currently `{'2026-08-11': 'Back to School'}`), `AK.toYMD(date)`, `AK.parseYMD(ymd)`, `AK.openingWindows(date)` → `[[startMin,endMin],…]`, `AK.openStatus(now?)` → `{open, label, detail}` e.g. `{open:true,label:'Jetzt geöffnet',detail:'bis 22:00 Uhr'}`.
- Body scroll lock: `AK.lock()` / `AK.unlock()` (ref-counted).
- Do not use `localStorage` for anything important; wrap `sessionStorage` access in try/catch.
- No external network requests besides those the original site made (Google Apps Script for reservations; Google Maps iframe only after consent click).

## Image inventory (`images/`, width × height)
aussen-eingang.jpg 1600×1200 · aussen-fassade.jpg 1600×1200 · aussen-schild.jpg 1200×1600 · aussen-terrasse.jpg 1600×1200 ·
buffet-desserts.jpg 1200×1600 · buffet-grill.jpg 1200×1600 · buffet-schokobrunnen.jpg 1200×1600 · buffet-station.jpg 1200×1600 · buffet-sushi.jpg 1200×1600 · teppan-garnelen.jpg 1200×1600 ·
innen-aquarium.jpg 1600×1200 · innen-bankettsaal.jpg 1200×1600 · innen-bar.jpg 1200×1600 · innen-buddha.jpg 1200×1600 · innen-drache.jpg 1200×1600 · innen-eingang.jpg 1200×1600 · innen-getraenke.jpg 1600×1200 · innen-hauptsaal.jpg 1200×1600 · innen-hauptsaal2.jpg 1200×1600 · innen-kronleuchter.jpg 1600×937 · innen-kronleuchter2.jpg 1600×937 · innen-privatraum.jpg 1600×1200 · innen-restaurant.jpg 1200×1600 · innen-vip-raum.jpg 1600×1200 ·
kinder-bereich.jpg 1200×1600 · kinder-spielautomat.jpg 1200×1600 ·
logo-asia-khan.png 920×375 (transparent) · russische-nacht-band-freigestellt.png 820×922 (+ .avif 1536×1728, transparent) · russische-nacht-flyer.jpg 1001×1416 · russische-nacht-flyer-klein.jpg 300×424 · video-poster.jpg 1280×720 · og-asia-khan-buerstadt.jpg 1200×630

Blender renders (being produced in `renders/`, may not exist yet while you work — reference them anyway, with graceful fallback): `renders/lantern.webp|png` (single glowing red lantern, transparent, ~600×900), `renders/steamer.webp|png` (bamboo dim-sum steamer, transparent, ~900×700).

## Preview / testing
`node build.mjs` then serve the repo root (`python3 -m http.server 8080` from the repo root) and screenshot with Playwright (`require('playwright')`, `chromium.launch()`), at 1440×900 and 390×844. Look at your screenshots with the Read tool and fix layout problems. Other agents build in parallel, so other sections may be missing or half-done — only judge your own.
