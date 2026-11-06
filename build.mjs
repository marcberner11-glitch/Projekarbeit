// Baut die Website aus den Quellbausteinen in src/ zusammen.
//   node build.mjs
// src/partials/*.html → index.html   (in Dateinamen-Reihenfolge)
// src/css/*.css       → css/style.css
// src/js/*.js         → js/app.js
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const banner = (f) => `Automatisch erzeugt aus src/${f} – bitte dort bearbeiten (node build.mjs)`;

function bundle(dir, ext, sep) {
  const full = join(root, 'src', dir);
  return readdirSync(full)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => sep(f) + readFileSync(join(full, f), 'utf8').trimEnd())
    .join('\n\n');
}

const html = bundle('partials', '.html', (f) => (f.startsWith('00-') ? '' : `<!-- ═══ ${f} ═══ -->\n`));
const css = `/* ${banner('css')} */\n\n` + bundle('css', '.css', (f) => `/* ─── ${f} ─── */\n`);
const js = `/* ${banner('js')} */\n\n` + bundle('js', '.js', (f) => `/* ─── ${f} ─── */\n`);

mkdirSync(join(root, 'css'), { recursive: true });
writeFileSync(join(root, 'index.html'), html.replace('<head>', `<head>\n<!-- ${banner('partials')} -->`) + '\n');
writeFileSync(join(root, 'css/style.css'), css + '\n');
writeFileSync(join(root, 'js/app.js'), js + '\n');

console.log(`index.html  ${(html.length / 1024).toFixed(1)} KB\ncss/style.css ${(css.length / 1024).toFixed(1)} KB\njs/app.js  ${(js.length / 1024).toFixed(1)} KB`);
