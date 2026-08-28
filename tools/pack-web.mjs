// Builds a copy of the app that can be hosted, to be installed on a phone that
// cannot sideload an APK - which in practice means an iPhone, where Add to Home
// Screen is the only route there is.
//
// It is `www/` minus `www/bible/`, and the omission is the entire point.
// Publishing the app is fine; publishing the Orthodox Study Bible's text with
// it is redistributing a commercial translation, which docs/BIBLE.md sets out
// and the deleted Pages workflow was deleted over. So the scripture stays
// behind, sw.js caches those files best-effort precisely so their absence
// costs nothing, and a build handed to someone else is locked anyway: it has
// no Bible section to open, so nothing is missing from where they are sitting.
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

const { bytes, files } = await measure(out);
console.log(`dist-web/  ${files} files, ${(bytes / 1048576).toFixed(1)} MB`);
console.log('No scripture in it: an install from this build has no Bible section to open.');
