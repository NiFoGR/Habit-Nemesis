// Everything Play wants a picture of: the seven screenshots and the feature
// graphic. Taken from the app rather than drawn.
//
//     npm i -D playwright-core && npm run dev
//     npm run store
//
// Not part of `npm run check`: it needs a browser and a running server, and it
// is run by hand when a screen it covers changes. The order and the screens are
// docs/STORE.md section 5, which is the source for the listing.
//
// 1080 x 1920 is exactly 9:16, which is what Play asks for, and everything here
// is 24-bit RGB, because Play refuses alpha.

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { decodePng, encodeRgb } from './png.mjs';
import { MARK } from '../www/js/icons.js';

const BASE = process.env.SHOTS_BASE || 'http://localhost:8080';
const CHROME = process.env.SHOTS_CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const OUT = 'store/';
const TMP = 'store/.raw.png';

// 360 x 640 at 3x. A real phone size, and the app is laid out for this width.
const W = 360;
const H = 640;
const SCALE = 3;

const SHOTS = [
  ['01-arena', '#/arena', 'The week is a match'],
  ['02-grid', '#/hub', 'The grid'],
  ['03-divisions', '#/arena/divisions', 'The ladder'],
  ['04-cabinet', '#/cabinet', 'The Cabinet'],
  ['05-habit', '#/habits/habit?id=h_0', 'A habit in full'],
  ['06-arc', '#/arena/arc', 'The knockout'],
  ['07-nemesis', '#/arena/nemesis', 'The record against him'],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
  serviceWorkers: 'block',
});
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });

const tick = (ms = 600) => page.waitForTimeout(ms);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ---------------- the day it is taken on ----------------
   A month ends with the Nemesis, so on most days the fixture is an undercard.
   The shot the app is sold on is the one against him, so the clock is moved to
   his week rather than the screen being staged. Midweek, so the grid has both
   marks and days left on it. */

const thursdayOf = (d) => { const t = new Date(d); t.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3); return t; };
const monthOf = (d) => { const t = thursdayOf(d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
const lastWeekOfMonth = (d) => monthOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) !== monthOf(d);

const NOW = (() => {
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, 12, 0, 0);
    if (c.getDay() === 3 && lastWeekOfMonth(c)) return c;
  }
  throw new Error('no Nemesis week within a year');
})();

const day = (n) => iso(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n));

// Pinned before any app code runs, so the record and the screen agree on today.
await context.addInitScript(`{
  const Real = Date;
  const fixed = ${NOW.getTime()};
  globalThis.Date = class extends Real {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  };
}`);

/* ---------------- the record on show ----------------
   A year of marks and a season behind you, because an empty app photographs as
   an empty app. Every number here is one the app would have produced itself. */

function seed(arg) {
  const [days, arena] = arg;
  localStorage.clear();
  const names = [
    ['Run', 'orange', 'yesno', 'g_1'],
    ['Read', 'sky', 'yesno', 'g_1'],
    ['Water', 'teal', 'number', 'g_2'],
    ['Meditate', 'violet', 'yesno', 'g_2'],
    ['Gym', 'lime', 'yesno', ''],
    ['Cold shower', 'plum', 'yesno', ''],
  ];
  const items = names.map((n, i) => ({
    id: `h_${i}`, name: n[0], colour: n[1], kind: n[2],
    unit: n[2] === 'number' ? 'l' : '', target: n[2] === 'number' ? 2 : 0,
    targetType: 'atleast', freq: { num: 1, den: 1 },
    createdAt: Date.now() - 400 * 864e5, order: i,
    remindDays: [0, 1, 2, 3, 4, 5, 6], remindAt: '', group: n[3], notes: '',
    archived: false, archivedAt: 0,
  }));
  const entries = {};
  items.forEach((h, i) => {
    entries[h.id] = {};
    // Misses thin out as the record comes forward, so the chart climbs instead
    // of drawing the flat line an even pattern gives.
    days.forEach((k, j) => {
      const stride = 2 + Math.floor((days.length - j) / 60);
      if ((i + j) % stride === 0) return;
      if ((i + j) % 17 === 0) { entries[h.id][k] = -1; return; }
      entries[h.id][k] = h.kind === 'number' ? 1.5 + (j % 3) : 1;
    });
  });
  localStorage.setItem('habitnemesis.state.v1', JSON.stringify({
    v: 1, createdAt: Date.now() - 400 * 864e5,
    settings: { onboarded: true },
    habits: {
      settings: { catchUpDay: days[0] },
      groups: [{ id: 'g_1', name: 'Morning', order: 0 }, { id: 'g_2', name: 'Health', order: 1 }],
      items, entries, notes: {},
    },
    // Every ceremony already seen, so a shot is the screen asked for and not
    // the result screen queued in front of it.
    arena: { seenPlacement: '2099-W01', seenWeek: '2099-W01', seenMonth: '2099-01', reviewed: '2099-W01', ...arena },
    ads: {},
  }));
}

/** Weeks, months and cups behind you. `peak` is the week that became his best. */
function history(n, base, swing, peak, division) {
  const wkKey = (dt) => {
    const th = thursdayOf(dt);
    const y = th.getFullYear();
    const jan = new Date(y, 0, 1);
    return `${y}-W${String(Math.ceil(((th - jan) / 864e5 + jan.getDay() + 1) / 7)).padStart(2, '0')}`;
  };
  const now = NOW;
  const running = monthOf(now);
  const weeks = {};
  const months = {};
  for (let i = 1; i <= n; i++) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
    const m = monthOf(dt);
    const score = i === 3 ? peak : Math.min(0.97, base + ((i * 11) % swing) / 100);
    const opp = i % 4 === 0 ? 'nemesis' : 'standard';
    weeks[wkKey(dt)] = {
      score, due: 42, done: Math.round(42 * score),
      opponent: opp, oppName: opp === 'nemesis' ? 'Your Nemesis' : 'The Standard',
      oppScore: opp === 'nemesis' ? peak - 0.04 : 0.6,
      result: i % 3 ? 'won' : 'lost', arc: null,
    };
    if (m !== running) months[m] = { score: base, w: 3, l: 1, from: division, to: division, move: 'held', cleared: true };
  }
  return { weeks, months };
}

async function settle() {
  for (let i = 0; i < 12; i++) {
    const h = await page.evaluate(() => location.hash);
    if (h.startsWith('#/arena/moment') || h.startsWith('#/arena/rank')) { await page.click('#go'); await tick(400); continue; }
    if (h.startsWith('#/arena/result')) {
      if (await page.$('#reveal')) { await page.click('#reveal'); await tick(300); }
      await page.click('#onward'); await tick(400); continue;
    }
    if (h !== '#/hub') { await page.evaluate(() => { location.hash = '#/hub'; }); await tick(400); continue; }
    break;
  }
  if (await page.$('.sheet')) { await page.click('.sheet [data-close]'); await tick(300); }
}

/** Playwright writes RGBA. Play wants neither the alpha nor a page taller than
 *  the phone, so the shot is the viewport and the channel goes on the way out. */
async function shot(name, want) {
  await page.screenshot({ path: TMP, fullPage: false });
  const { width, height, rgba } = decodePng(readFileSync(TMP));
  const [ww, wh] = want || [W * SCALE, H * SCALE];
  if (width !== ww || height !== wh) throw new Error(`${name}: ${width}x${height}, wanted ${ww}x${wh}`);
  writeFileSync(`${OUT}${name}.png`, encodeRgb(width, height, rgba));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (wide) problems.push(`horizontal scroll: ${name}`);
  console.log(`  ok   ${name}.png  ${width}x${height}`);
}

/* ---------------- the run ---------------- */

const DIVISION = 'contender';
await page.goto(BASE + '/');
await page.evaluate(seed, [
  Array.from({ length: 400 }, (_, i) => day(i)),
  {
    division: DIVISION, placed: true, scoring: 1,
    ...history(30, 0.68, 18, 0.91, DIVISION),
    arcs: {
      [`${new Date().getFullYear() - 1}-autumn`]: { qualified: true, qf: 'won', sf: 'won', final: 'won', won: true },
      [`${new Date().getFullYear()}-spring`]: { qualified: true, qf: 'won', sf: 'lost', final: null, won: false },
    },
  },
]);
await page.reload();
await tick(900);
await settle();

for (const [name, hash] of SHOTS) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await tick(1100);
  await page.evaluate(() => window.scrollTo(0, 0));
  await tick(250);
  await shot(name);
}

/* ---------------- the feature graphic ----------------
   1024 x 500, and Play crops the edges on some surfaces, so nothing that has to
   be read goes in the outer eighth. The mark, the cut, black ground, one line. */

const path = MARK.map((ring) => `M${ring.map(([x, y]) => `${x},${y}`).join(' ')}Z`).join('');

// Its own context: the phone shots run at 3x, and this one is already the size
// Play asks for.
const flat = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const feature = await flat.newPage();
await feature.goto(`data:text/html;charset=utf-8,${encodeURIComponent(`
<!doctype html><meta charset="utf-8"><title>feature</title>
<style>
  html, body { margin: 0; height: 100%; background: #080a0e; }
  body {
    display: grid; grid-template-columns: auto auto; align-items: center;
    justify-content: center; gap: 44px; box-sizing: border-box;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #e6eaf0;
  }
  .glow {
    position: absolute; left: 96px; top: 50%; width: 460px; height: 460px;
    transform: translateY(-50%); pointer-events: none;
    background: radial-gradient(circle, rgba(240,32,42,0.22), transparent 62%);
  }
  svg { width: 168px; height: 168px; display: block; position: relative; }
  h1 { margin: 0; font-size: 62px; letter-spacing: -1.5px; font-weight: 700; line-height: 1; }
  p { margin: 18px 0 0; font-size: 27px; line-height: 1.25; color: #8b97a8; max-width: 19em; }
</style>
<div class="glow"></div>
<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="#f0202a" fill-rule="evenodd" d="${path}"/></svg>
<div>
  <h1>Habit Nemesis</h1>
  <p>Your only opponent is the best week you have ever had.</p>
</div>
`)}`);
await feature.waitForTimeout(700);
await feature.screenshot({ path: TMP });
{
  const { width, height, rgba } = decodePng(readFileSync(TMP));
  if (width !== 1024 || height !== 500) throw new Error(`feature: ${width}x${height}`);
  writeFileSync(`${OUT}feature.png`, encodeRgb(width, height, rgba));
  console.log(`  ok   feature.png  ${width}x${height}`);
}

rmSync(TMP, { force: true });
await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`\nok  ${SHOTS.length} screenshots and the feature graphic in ${OUT}`);
