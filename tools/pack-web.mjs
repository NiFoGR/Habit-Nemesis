// Builds a copy of the app that can be hosted, to be installed on a phone that
// cannot sideload an APK - which in practice means an iPhone, where Add to Home
// Screen is the only route there is.
//
// It is `www/` minus `www/bible/`. The scripture is 7 MB of the app's 8, and
// an install from this build is locked, so it has no Bible section to open:
// shipping it would be a slower download and nothing else. sw.js caches those
// files best-effort precisely so their absence costs nothing.
//
// Run: node tools/pack-web.mjs   (npm run pack:web)
// Then serve dist-web/ over HTTPS, open it in Safari, Share, Add to Home
// Screen. It has to be HTTPS or a service worker will not register and the app
// will not work offline.

import { cp, rm, mkdir, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const src = new URL('www/', root);
const out = new URL('dist-web/', root);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await cp(src, out, {
  recursive: true,
  filter: (from) => !fileURLToPath(new URL('.', `file://${from}/`)).includes('/www/bible/')
    && !from.endsWith('/www/bible'),
});

async function measure(dir) {
  let bytes = 0;
  let files = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
    if (e.isDirectory()) {
      const sub = await measure(p);
      bytes += sub.bytes;
      files += sub.files;
    } else {
      bytes += (await stat(p)).size;
      files++;
    }
  }
  return { bytes, files };
}

// Checked by looking rather than by trusting the filter above, because a copy
// step that changes shape or a file that lands somewhere new would put the 7 MB
// back without anything else noticing.
async function scriptureIn(dir, hits = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
    if (e.isDirectory()) await scriptureIn(p, hits);
    else if (/\.json$/.test(e.name) && fileURLToPath(p).includes('/bible/')) hits.push(fileURLToPath(p));
  }
  return hits;
}

const leaked = await scriptureIn(out);
if (leaked.length) {
  console.error(`\nREFUSING: ${leaked.length} scripture file(s) reached dist-web/, starting with`);
  console.error(`  ${leaked[0]}`);
  console.error('This build leaves them out on size; see docs/BIBLE.md.');
  process.exit(1);
}

const { bytes, files } = await measure(out);
console.log(`dist-web/  ${files} files, ${(bytes / 1048576).toFixed(1)} MB`);
console.log('No scripture in it: an install from this build has no Bible section to open.');
