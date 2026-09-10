// The sign-in gate's arithmetic, checked. `npm run check:account`.
//
// The gate is the one piece of the account that has a rule rather than a call,
// and every way round it is a way round it for everybody. These are the ways
// that were thought of.

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const g = await import('../www/js/account/gate.js');

let passed = 0;
const failed = [];
const is = (name, got, want) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed.push(name);
    console.log(`  FAIL ${name}\n         got  ${a}\n         want ${b}`);
  }
};
const group = (t) => console.log(`\n${t}`);
const T = 1_700_000_000_000;

group('the wait');
is('the free tries cost nothing', [0, 1, 4, 5].map(g.waitFor), [0, 0, 0, 0]);
is('the sixth is the first that waits', g.waitFor(6), g.FIRST);
is('and each one after it doubles', [7, 8, 9].map(g.waitFor), [60000, 120000, 240000]);
is('capped, so it is a wait and not a lockout', [12, 20, 99].map(g.waitFor), [g.CAP, g.CAP, g.CAP]);
is('a wait reads as seconds under a minute and minutes over it',
  [1000, 59000, 60000, 900000].map(g.saySoon), ['1s', '59s', '1 min', '15 min']);

group('five tries, then a wait');
{
  g.reset();
  const me = 'someone@example.com';
  is('nothing owed at the start', g.waitLeft(me, T), 0);
  for (let i = 1; i <= 5; i++) g.fail(me, T);
  is('five wrong passwords still let you try', g.waitLeft(me, T), 0);
  is('and the screen can say how many are left', g.triesLeft(me), 0);
  is('the sixth earns the first wait', g.fail(me, T), g.FIRST);
  is('which runs down', g.waitLeft(me, T + 20000), 10000);
  is('and ends', g.waitLeft(me, T + g.FIRST), 0);
}

group('the ways round it');
{
  // The address is the obvious dial to turn, so the device counts as well.
  g.reset();
  for (let i = 0; i <= g.DEVICE_FREE; i++) g.fail(`try${i}@example.com`, T);
  is('a fresh address every time still runs the device out',
    g.waitLeft('never-tried@example.com', T) > 0, true);
  is('and the device wait is the same shape', g.waitLeft('never-tried@example.com', T), g.FIRST);
}
{
  // One account waiting is not every account waiting.
  g.reset();
  const mine = 'mine@example.com';
  for (let i = 0; i < 6; i++) g.fail(mine, T);
  is('a wait on one address leaves the others alone', g.waitLeft('other@example.com', T), 0);
  is('while that one waits', g.waitLeft(mine, T) > 0, true);
}
{
  // Moving the clock back is the cheapest trick on a device, and it is the one
  // a wait written as a timestamp is open to.
  g.reset();
  const me = 'clock@example.com';
  for (let i = 0; i < 6; i++) g.fail(me, T);
  is('a clock moved back does not release the wait', g.waitLeft(me, T - 86400000) > 0, true);
}
{
  // The device count is a window: a week of honest typos is not an attack.
  g.reset();
  for (let i = 0; i <= g.DEVICE_FREE; i++) g.fail(`old${i}@example.com`, T);
  is('an old run of failures is forgotten', g.waitLeft('new@example.com', T + g.WINDOW + 1000), 0);
}
{
  g.reset();
  const me = 'right@example.com';
  for (let i = 0; i < 8; i++) g.fail(me, T);
  g.pass(me);
  is('knowing the password clears what was owed', g.waitLeft(me, T), 0);
  is('and clears the device with it', g.waitLeft('anyone@example.com', T), 0);
}

group('what comes off disk');
{
  g.reset();
  localStorage.setItem('habitnemesis.gate.v1', 'not json at all');
  is('rubbish reads as nothing owed', g.waitLeft('a@example.com', T), 0);
  localStorage.setItem('habitnemesis.gate.v1', JSON.stringify({ who: { 'a b': { n: -5, until: 1e18 } }, device: { n: 'lots' } }));
  is('and so does a hand-edited one', g.waitLeft('a@example.com', T), 0);

  g.reset();
  for (let i = 0; i < 40; i++) g.fail(`p${i}@example.com`, T + i);
  const kept = Object.keys(JSON.parse(localStorage.getItem('habitnemesis.gate.v1')).who).length;
  is('the list of accounts is bounded', kept <= 20, true);
}

console.log(failed.length ? `\n${failed.length} FAILED: ${failed.join('; ')}` : `\nall ${passed} checks passed`);
process.exit(failed.length ? 1 : 0);
