# Blender-Assets – Asia Khan

Alle 3D-Medien in `../renders/` werden von diesen Skripten komplett prozedural
erzeugt (keine externen Texturen/HDRIs). Jedes Skript leert die Szene, baut sie
neu auf, rendert mit **Cycles (CPU)** und konvertiert die Ausgabe.

| Skript | Ergebnis |
|---|---|
| `hero_lanterns.py` | `renders/hero-lanterns.mp4`, `.webm`, `hero-lanterns-poster.jpg` – 8-s-Loop, 1600×900, 24 fps |
| `gate_sequence.py` | `renders/gate/frame-000.webp … frame-059.webp`, `renders/gate-poster.jpg` – 1280×720 |
| `stills.py` | `renders/lantern.png/.webp` (600×900), `renders/steamer.png/.webp` (900×700), RGBA |

Ausgabepfade stehen als Konstanten oben in jedem Skript (`RENDER_DIR`, `FRAME_DIR`, …).

## Neu rendern

**In Blender (≥ 5.2):** Scripting-Tab → *Open* → Skript wählen → *Run Script*.
Die Szene wird aufgebaut und sofort gerendert (Blender ist währenddessen blockiert).
Wer nur die Szene ansehen will, setzt oben `RENDER = False`. `RENDER_DIR` wird aus dem Skriptpfad
abgeleitet (`../renders`); falls Blender beim Ausführen aus dem Text-Editor keinen echten Dateipfad liefert,
`RENDER_DIR` oben im Skript fest eintragen.

**Headless (ohne Blender-Installation):**

```bash
python -m venv .venv && . .venv/bin/activate
pip install bpy==5.2.3 pillow imagequant   # bpy = Blender als Python-Modul; imagequant optional (PNG-Palette)
python blender/hero_lanterns.py      # ~30 min auf 4 CPU-Kernen (192 Frames à ~8–10 s)
python blender/gate_sequence.py      # ~10 min (60 Frames, helle Frames sind schnell)
python blender/stills.py             # ~5 min (AK_ONLY=lantern|steamer für nur eins)
```

Test-Overrides per Umgebungsvariable: `AK_PCT=50` (Auflösung in %), `AK_SAMPLES=8`,
`AK_FRAMES=0,96,192` (nur diese Frames), `AK_FRAME_DIR=/pfad` (Zwischen-PNGs),
`AK_NO_ENCODE=1` (Hero: kein ffmpeg).

### Render-Einstellungen (Stand der gelieferten Dateien)

- Hero: 1600×900, 16 Samples (adaptiv, Schwelle 0.03), OpenImageDenoise (Prefilter *Fast*),
  max. 3 Bounces, Farbmanagement *Standard*, Compositor *Fog Glow*, f/0.45-Tiefenschärfe (Fokus 9 m).
- Tor: 1280×720, 12 Samples (adaptiv, Schwelle 0.03), OIDN (Prefilter *Fast*), Farbmanagement *Standard*
  (AgX würde das Gold zu Creme entsättigen), Compositor *Sun Beams* (ab Frame 8 eingeblendet) + *Fog Glow*,
  Belichtung steigt ab Frame 44 leicht an. Tür öffnet Frame 2–38 (0→104°, ease-in-out),
  Kamera-Dolly über alle 60 Frames (y −9.6 → +2.6 m), Durchfahrt durch die Türebene ≈ Frame 38–40.
- Stills: Laterne 64 / Dampfkorb 128 Samples, OIDN (Prefilter *Accurate*), `film_transparent`;
  Laterne in *Standard* (sattes Rot), Dampfkorb in *AgX* (natürliche Bambus-/Teigtöne), Dampf als Volumen.
  Kein Schattenfänger – Schatten/Glow im Web per CSS `filter: drop-shadow(...)`.

Hinweise für headless-Betrieb: `bpy.ops.wm.read_factory_settings(use_empty=True)` ist nötig
(sonst rendert die Welt schwarz), und der Compositor muss auf `compositor_device = "CPU"` stehen
(ohne GPU/EGL bricht Blender sonst ab).

### Loop-Prinzip (Hero)

Jede Laterne gehört zu einem „Strom“ aus *n* Laternen im Abstand H/n. In 192 Frames steigt
jede Laterne genau H/n – Laterne *j* endet im Startzustand von Laterne *j+1*. Pendeln, Drehung,
Flackern und Seitendrift sind Funktionen der Bahnposition (periodisch in H), das Rauschmuster
ist fix (`use_animated_seed = False`) → Frame 192 ≡ Frame 0. Das Umspringen passiert außerhalb des Bildes.

## Encoding / Konvertierung

Hero (macht `hero_lanterns.py` automatisch, falls `ffmpeg` im PATH ist):

```bash
ffmpeg -y -framerate 24 -start_number 0 -i hero_%04d.png -frames:v 192 -an \
  -c:v libx264 -preset slow -crf 18 -profile:v high -tune film -pix_fmt yuv420p \
  -movflags +faststart renders/hero-lanterns.mp4
ffmpeg -y -framerate 24 -start_number 0 -i hero_%04d.png -frames:v 192 -an \
  -c:v libvpx-vp9 -b:v 0 -crf 28 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p \
  renders/hero-lanterns.webm
# Poster: Frame 0 als JPEG q80 (Pillow; Fallback: ffmpeg -i hero_0000.png -q:v 4 …)
```

Tor-Frames und Stills (Pillow; passiert automatisch am Skriptende, wenn Pillow installiert ist):

```python
Image.open("gate_000.png").convert("RGB").save("renders/gate/frame-000.webp", "WEBP", quality=68, method=6)
Image.open("gate_000.png").convert("RGB").save("renders/gate-poster.jpg", "JPEG", quality=80, optimize=True, progressive=True)
im = Image.open("lantern_raw.png").convert("RGBA")
im.save("renders/lantern.webp", "WEBP", quality=88, method=6)
im.save("renders/lantern.png", "PNG", optimize=True)   # > 400 KB → 256-Farben-Palette (libimagequant)
```

Beim Dampfkorb wird vorher das Volumen-Rauschen des Dampfs geglättet (Gauß-Weichzeichner nur in
halbtransparenten Bereichen, siehe `optimize(..., soften_steam=True)` in `stills.py`).
