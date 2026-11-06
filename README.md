# Asia Khan Bürstadt – neue Website

Neue, animierte One-Page-Website für **Asia Khan** (Lampertheimer Straße 21, 68642 Bürstadt).
Alle Inhalte, Preise, Bilder und das Reservierungssystem der bisherigen Seite sind übernommen
und neu strukturiert. Dazu kommen 3D-Renderings aus Blender und scroll-gesteuerte Animationen mit GSAP.

## Schnellstart

```bash
node build.mjs                 # index.html, css/style.css und js/app.js aus src/ erzeugen
python3 -m http.server 8080    # lokal ansehen: http://localhost:8080
```

Eine einzelne HTML-Datei mit eingebettetem CSS/JS (für den Webspace neben `images/`, `videos/`, `fonts/`, `js/`, `renders/`):

```bash
node build.mjs --standalone index.standalone.html
```

Hochladen auf den Webspace: den kompletten Ordner (ohne `src/`, `blender/`, `tests/`, `build.mjs`)
in das Web-Verzeichnis kopieren. Es gibt keine Server-Abhängigkeiten, alles ist statisch.

## Aufbau

| Pfad | Inhalt |
|------|--------|
| `index.html` | **erzeugt** – nicht direkt bearbeiten |
| `css/style.css`, `js/app.js` | **erzeugt** aus `src/css` und `src/js` |
| `src/partials/NN-*.html` | die Abschnitte der Seite (Reihenfolge = Dateiname) |
| `src/css/NN-*.css`, `src/js/NN-*.js` | Styles und Skripte je Abschnitt |
| `src/CONVENTIONS.md` | Designsystem, Klassen, Animations-Attribute |
| `images/`, `videos/`, `fonts/` | Fotos, Rundgang-Video, lokal eingebundene Schriften (DSGVO: keine Google-Verbindung) |
| `renders/` | in Blender gerenderte Medien (Laternen-Loop, Tor-Sequenz, Freisteller) |
| `blender/` | Blender-Skripte zum Neu-Rendern (siehe `blender/README.md`) |
| `tests/` | automatischer Test des Reservierungssystems |
| `impressum.html`, `datenschutz.html`, `russische-nacht.html` | Unterseiten (von der bisherigen Seite übernommen) |

## Abschnitte

Hero (Blender-Laternen) · Info-Leiste mit Live-Öffnungsstatus · Über uns mit 3D-Tor-Sequenz ·
Video · Buffet & Preise · Speisekarte (Filter + Suche) · Feiern & Events · Familien · Partyservice ·
Happy Meal To Go · Google-Bewertungen · Galerie mit Lightbox · **Reservierung** · Kontakt & Anreise
(Karte erst nach Klick) · FAQ · Footer · Event-Popup „Russische Live-Musik-Nacht“ (bis 27.11.2026) ·
mobile Schnellaktionsleiste.

## Reservierungssystem

Unverändert in der Funktion:

1. Die Reservierung wird an die Google-Apps-Script-Web-App geschickt (Google Sheet).
2. Danach öffnen sich eine vorausgefüllte E-Mail an `buerstadt.asiakhan@gmail.com` und eine WhatsApp-Nachricht an `+49 170 1618887`.
3. Dienstag (Ruhetag) ist gesperrt, außer an gesetzlichen Feiertagen in Hessen und an Sonder-Öffnungstagen.

Sonder-Öffnungstage pflegen: in `src/js/00-core.js` → `AK.SONDER_OEFFNUNGSTAGE` (Format `'JJJJ-MM-TT': 'Name'`), danach `node build.mjs`.

Test ausführen:

```bash
node build.mjs && node tests/reservierung.test.cjs
```

## Animationen

- **GSAP + ScrollTrigger** (lokal in `js/`), gesteuert über Attribute wie `data-reveal`, `data-split`,
  `data-parallax`, `.kb` (Kamerafahrt auf Fotos) – Details in `src/CONVENTIONS.md`.
- **Blender-Renderings** (`renders/`, Blender 5.2, Cycles): nahtloser 8-Sekunden-Laternen-Loop im Hero (MP4 + WebM),
  60-Bilder-Sequenz „Tor öffnet sich“, die beim Scrollen abgespielt wird, sowie Laterne und Dim-Sum-Korb als Freisteller.
  Neu rendern: siehe `blender/README.md`.
- Wer „Bewegung reduzieren“ im Betriebssystem eingestellt hat, bekommt eine ruhige Version ohne Animationen.

## Saisonale Inhalte

- Popup und Hinweis „Russische Live-Musik-Nacht“ blenden sich ab dem 28.11.2026 automatisch aus.
- Das abgelaufene „Back to School“-Popup (11.08.2026) wurde nicht übernommen; der Sonder-Öffnungstag bleibt in der Ruhetag-Logik hinterlegt.
