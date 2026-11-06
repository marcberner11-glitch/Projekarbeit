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

// Optional: eigenständige HTML-Datei mit eingebettetem CSS/JS (node build.mjs --standalone ziel.html)
const si = process.argv.indexOf('--standalone');
if (si > -1) {
  const target = process.argv[si + 1] || join(root, 'index.standalone.html');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  let page = html
    .replace('<head>', '<head>\n<!-- Eigenständige Version: CSS und JavaScript eingebettet. Benötigt die Ordner images/, videos/, fonts/, js/ (GSAP) und renders/ daneben. -->')
    .replace('<link href="css/style.css" rel="stylesheet">', () => `<style>\n${css}\n</style>`)
    .replace(/<script src="js\/gsap\.min\.js" defer><\/script>\n<script src="js\/ScrollTrigger\.min\.js" defer><\/script>\n<script src="js\/app\.js" defer><\/script>\n/, '')
    .replace('</body>', () => `<script src="js/gsap.min.js"></script>\n<script src="js/ScrollTrigger.min.js"></script>\n<script>\n${safeJs}\n</script>\n</body>`);
  if (page.includes('src="js/app.js"') || page.includes('href="css/style.css"')) throw new Error('Standalone: Einbetten fehlgeschlagen');
  writeFileSync(target, page + '\n');
  console.log(`standalone ${(page.length / 1024).toFixed(1)} KB → ${target}`);
}

console.log(`index.html  ${(html.length / 1024).toFixed(1)} KB\ncss/style.css ${(css.length / 1024).toFixed(1)} KB\njs/app.js  ${(js.length / 1024).toFixed(1)} KB`);
