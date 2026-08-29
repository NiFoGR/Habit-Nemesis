// The hostable build: www/ minus www/bible/, for a phone that cannot sideload.
// The scripture is 7 MB of the app's 8 and a locked install cannot open it.
//
//   node tools/pack-web.mjs   (npm run pack:web)
//
// Serve dist-web/ over HTTPS or the service worker will not register.

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

// Measured, not trusted: a copy step that changes shape would put the 7 MB back.
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
