# Art manifest

Every image the app wants, what it has to say, and the file it becomes.

Filenames are not decoration: each one is keyed to an id in the code, so a file
dropped in with the right name is picked up with no further work.

## The rules every asset follows

| | |
|---|---|
| Format to send | PNG or SVG, transparent background |
| Size to send | 1024 x 1024 for ranks and cups, 512 x 512 for feat medals, 1080 x 1350 for share banners |
| What ships | 256px WebP, generated from your file by `npm run art` |
| Safe area | keep the artwork inside the middle 88%. Nothing touches the edge |
| Shape | square canvas, and the art optically centred inside it |
| Ground | transparent. The app puts it on `#0a0c10` and on `#141821` cards |

**The 28px test.** A rank badge appears at 28px next to a name far more often
than it appears at 92px as a hero. A feat medal appears at 22px in a grid of
forty. If it does not read at 28px, it does not work, whatever it looks like
large. Squint at it: silhouette first, then one colour, then at most one shape
inside. Three or more details inside a badge turn to mud.

**Palette.** Dark ground, one accent. Metals are allowed and are how a tier is
told apart.

```
bg      #0a0c10      surface #141821      line   #262c38
text    #e6eaf0      muted   #97a1b0
accent  #22d3c5      violet  #a78bfa      good   #4ade80
warn    #fbbf24      danger  #f87171      calm   #38bdf8
bronze  #b06a3a      silver  #c3ccd8      gold   #e8b23a
```

**One silhouette per family.** All eight ranks share an outline. All four cups
share an outline. All feat medals share an outline. The tier is told by what is
inside it and what it is made of, never by a different shape. This is the single
biggest problem with the current set: four shields, one dashed hexagon, and a
crown that breaks the bounding box.

---

## 1. Ranks

Eight files. Worn at the top of the profile, in the Arena hero at 92px, and as a
28px badge beside a name. The ladder is the app's spine, so these carry the most
weight.

Named by division id, never by position: a division moved or added in the
middle of the ladder would otherwise renumber every file above it. Mentzer has
been moved from third to sixth and no file changed, which is the test of it.

In ladder order. The numbers are positions in `DIVISIONS`, not part of any
filename, which is the point of keying by id.

| File | Division | What it says |
|---|---|---|
| `rank-unranked.webp` | none | No record yet. Nobody knows what you are. Quiet, empty, waiting |
| `rank-bottom.webp` | 0 Bottom G, 20% | You own the app and nothing else. The joke rung |
| `rank-npc.webp` | 1 NPC, 30% | Going through the motions |
| `rank-prospect.webp` | 2 Prospect, 40% | Something is happening, not reliably. First metal |
| `rank-contender.webp` | 3 Contender, 50% | In it now. A bad week costs you |
| `rank-menace.webp` | 4 Menace, 60% | Most weeks go your way and it shows |
| `rank-mentzer.webp` | 5 Mentzer, 70% | Delusional confidence, earned late |
| `rank-locked.webp` | 6 Locked In, 80% | Serious. Relentless |
| `rank-topg.webp` | 7 Top G, 90% | You do not miss |
| `rank-full.webp` | 8 Full, 100% | Size without discipline. The top of the ladder |

Nine divisions, and a month moves you at most one, so the floor to the top is
eight months at the very fastest.

**Eight files, not nine: the three joke crests share nothing with the six real
ones.** That is deliberate. Bottom G, Mentzer and Full are photographs in a
frame and are supposed to look like a bit; the metal set climbs around them.

The progression has to be readable with the labels covered. Pick one thing that
climbs and let it climb: metal (dull to bright), rim weight, how much of the rim
is closed, or a count of marks inside. Do not change all four at once.

---

## 2. Cups

Three a year. Summer is a quarter with no tournament in it, so there is no
summer cup. Won at the end of an Arc, kept in the Cabinet for ever. These are
objects: they should have weight and read as something awarded.

| File | Cup | Feel |
|---|---|---|
| `cup-winter.webp` | Winter Arc | Cold, blue-white, hard |
| `cup-spring.webp` | Spring Arc | Green, sharp, new |
| `cup-autumn.webp` | Autumn Arc | Amber, heavy, low sun |
| `cup-blank.webp` | not won | The same cup, unlit. Drawn in outline, no fill |

One cup, three finishes. `cup-blank` is what an empty Cabinet shelf shows, so it
has to be the same object with the light off, not a different drawing.

Optional, if you want the bracket to have art: `cup-final.webp`,
`cup-semi.webp`, `cup-quarter.webp` for the round you reached without winning.

---

## 3. Feat medals

One file per feat, named `feat-<id>.webp` where `<id>` is the id in the table.
They render at 22px in the grid on the Feats screen and at 44px on the profile,
in two states: earned, in colour, and locked, which the app draws itself by
desaturating your file. So send the earned version only.

A medal is smaller than a rank badge and must be simpler: one silhouette shared
by all of them, one shape inside, one colour. A number inside is allowed where
the feat is a count.

### 3a. Public feats

These work for anyone, because they read only the grid and the Arena. This is
the set a public build ships with, and it is the one worth your time first.
All forty-five are built and earnable today: twenty-three on the grid,
twenty-two in the Arena. A public build ships these and nothing else.

**Streaks, on any one habit**

| id | Name | Earned when |
|---|---|---|
| `streak7` | A week straight | 7 days unbroken |
| `streak30` | A month straight | 30 days |
| `streak100` | A hundred days | 100 days |
| `habitYear` | A year of one thing | 365 days. *exists* |
| `streak1000` | A thousand days | 1000 days |

**The grid**

| id | Name | Earned when |
|---|---|---|
| `firstMark` | Day one | The first day you ever marked |
| `habits5` | Five at once | Five habits alive together |
| `habits10` | Ten at once | Ten habits alive together. *exists* |
| `perfectDay` | A perfect day | Every row green on the same day. *exists* |
| `perfectWeek` | A perfect week | Seven perfect days back to back. *exists* |
| `perfectMonth` | A perfect month | Thirty perfect days back to back |
| `noGaps30` | Nothing missed | Every cell that was due, done, for thirty days |
| `marks100` | A hundred ticks | 100 days marked, all told |
| `marks1000` | A thousand ticks | 1000 days marked |
| `marks10000` | Ten thousand ticks | 10000 days marked |
| `groupClear` | A group cleared | Every habit in one group at 100% for a week |

**Coming back**

| id | Name | Earned when |
|---|---|---|
| `comeback` | Back from the dead | Broke a streak of 30 or more, then built another 30 |
| `returned` | Came back | Away 14 days or more, then marked 7 days running |

**Counting**

| id | Name | Earned when |
|---|---|---|
| `counted1k` | A thousand counted | Any one measurable habit totals 1000 of its unit |
| `counted10k` | Ten thousand counted | The same, at 10000 |

**Score**

| id | Name | Earned when |
|---|---|---|
| `score90` | Ninety percent | One habit's score reaches 90% |
| `boardClean` | The whole board | Every habit above 75% at the same time |

**Longevity**

| id | Name | Earned when |
|---|---|---|
| `year1` | A year on the record | 365 days since the first entry |
| `year2` | Two years | 730 days |

**The Arena**

| id | Name | Earned when |
|---|---|---|
| `firstFixture` | Your first week | Played a fixture |
| `firstWin` | First blood | Won a week |
| `wins10` | Ten wins | Ten weeks won |
| `wins50` | Fifty wins | Fifty weeks won |
| `winStreak5` | Five in a row | Five straight weeks won |
| `weeks100` | A hundred weeks | A hundred fixtures played |
| `beatWorst` | Beat your worst | Out-scored Your Worst Self |
| `beatLastMonth` | Beat last month | Out-scored Last Month You |
| `beatNemesis` | Beat the Nemesis | Out-scored your best week ever. *exists* |
| `divProspect` | Prospect | Reached the Prospect division |
| `divContender` | Contender | Reached Contender |
| `divMenace` | Menace | Reached Menace. *exists* |
| `divLocked` | Locked In | Reached Locked In. *exists* |
| `divTopG` | Top G | Reached the top. *exists* |
| `topgHeld` | Top G, held | Finished a month at Top G and stayed. *exists* |
| `promoted2` | Two rungs, two months | Promoted in consecutive months |
| `noDrop6` | Six months, no step back | Six months without relegation |
| `arcQualified` | Out of the group | Qualified from a group stage |
| `arcFinal` | Reached a final | Played an Arc final |
| `arcWin` | An Arc | Won a cup. *exists* |
| `arcThree` | Three Arcs | Three cups. *exists* |
| `arcYear` | The clean sweep | All four cups of one year. *exists* |

That is 40 public feats, of which 12 already work.

### 3b. Private feats

These read the five preloaded sections, so they only exist on an unlocked
install. They work today. Their art is lower priority: the app currently draws
them with six shared line icons, which is why that screen looks like a
spreadsheet of stopwatches.

Kegels: `hold20` `hold30` `hold60` `reps1k` `reps10k` `kegel30` `week26`
`week52` `week104`

PE: `stretch2h` `stretch2hWeek` `stretch10` `stretch50` `stretch100` `grew1cm`
`girth5mm` `checkins12`

Bible: `books10` `gospels` `torah` `psalter` `newTestament` `wholeCanon`

Prayer: `rule40` `rule100` `rule1000`

Wind-down: `nights30` `nights100`

---

## 4. Section marks

Six, optional, and the thing that would move the app furthest away from looking
like a spreadsheet. One large mark per section home, sitting behind the header
the way the crest sits on the Arena. Abstract, not literal.

| File | Section | Idea |
|---|---|---|
| `mark-habits.webp` | The grid | A field of cells, some filled |
| `mark-arena.webp` | The Arena | Two chevrons meeting |
| `mark-kegels.webp` | Kegels | A sling under tension |
| `mark-pe.webp` | PE | A line being drawn out |
| `mark-bible.webp` | Bible | An open codex |
| `mark-breathe.webp` | Wind-down | A held centre, rings moving out |

512 x 512, and they can be softer and more atmospheric than the badges, because
they sit behind text rather than beside it.

---

## 5. Share banners

The background of the week card, the picture you send someone. Optional: with no
file the card draws its own gradient, glow and grain, which already works. A
banner replaces that.

**1080 x 1350, WebP, under 300KB.** No transparency, no text, no people, no
logos. The card lays its own dark veil over the top, so send it brighter than
you think.

| File | When it is used |
|---|---|
| `share-banner.webp` | any week, unless a division file exists |
| `share-bottom.webp` … `share-topg.webp` | that division only, one per rung |

Eight files at most, and one is enough to start. The division set is the version
worth having: the card looks different at Top G to how it looks at NPC, which is
the whole point of a ladder.

**Still outstanding: `share-full` and `share-mentzer`.** Every other division
has its banner. The card falls back to its own drawn background for these two,
so nothing is broken until they arrive.

### The prompt

Flat cartoon vector, not a render. A card competes in somebody's feed next to
a crypto app's profit banner, so it is loud, saturated and obviously drawn.
The first version of this prompt asked for photoreal lighting and film grain
on a near-black ground, and produced exactly that: a beautiful dead city
nobody would post.

**Attach the rank emblem** and replace `RANK` with its name.

> Attached is the **RANK** rank emblem from my app. Build a vertical
> 1080 x 1350 celebration banner in that emblem's world.
>
> Style: flat cartoon vector illustration. Bold saturated colour, thick clean
> outlines, chunky simple shapes, playful. Like the banner a crypto or fitness
> app shows when you hit a milestone. Sticker art, not a render. NO photoreal
> lighting, no film grain, no haze, no ruins, no realistic architecture, no
> cinematic darkness.
>
> The emblem itself must NOT appear: no badge, no shield, no crest, no ribbon,
> no text, no letters, no logo, no face. Use it only for the palette and the
> idea.
>
> Composition: **SHAPE**. A wide empty middle where big white type will sit,
> and all the energy pushed to the top and bottom edges. Rich but not muddy,
> so white type stays readable over it.
>
> Scene: **SCENE**.

Then add the rank's own **SCENE** line from the table below, and its
**SHAPE** line. Without those the generator returns the same picture in a
different colour every time: the composition has to differ, not just the hue.

| File | SCENE | SHAPE |
|---|---|---|
| `share-unranked` | a single closed grey shutter door in an empty concrete room, one dim bulb, dust, nothing else. Cold grey and gunmetal, no accent colour at all | dead centre and symmetrical, almost empty, the door small in a lot of nothing |
| `share-bottom` | a pink marble staircase that leads nowhere, bubblegum clouds, party balloons drifting up, a disco floor, confetti. Bubblegum pink and hot pink, silly and camp | bottom heavy: the staircase fills the lower third, balloons rising into empty sky above |
| `share-mentzer` | a suburban garage gym with one bench and a mirror, a wall of participation medals, a protein shaker, a novelty trophy. Blood red and black, proud and deluded | centred and flat, everything facing the viewer, the mirror dead centre |
| `share-full` | a diner table piled with food, a rainbow neon gym sign behind it, plates, tubs, an enormous chair. Rainbow neon on black, gluttonous | bottom heavy: the table across the lower half, the neon sign floating in the dark above |
| `share-npc` | an endless beige suburb of identical houses and identical doors, a queue of identical figures seen from behind, loading bars, a conveyor of grey cubes. Beige, tan and brown, drab | one-point perspective receding to a vanishing point dead centre, everything repeating |
| `share-prospect` | copper digital rain falling in vertical streams, glowing code, a bronze doorway of light opening at the far end, circuit traces. Copper, bronze and dark green | vertical: streams falling top to bottom the full height, the doorway small and far away |
| `share-contender` | two crossed spotlight beams over an empty boxing ring, chrome ropes, steel chevrons, chalk dust in the air. Chrome, silver and gunmetal | a big X: the two beams crossing diagonally corner to corner, the ring floor at the bottom |
| `share-menace` | dumbbells, weight plates and protein tubs raining down and piling up, gold chains, a gym under gold light. Gold, black and amber, excessive | top heavy raining into a bottom heavy pile, the middle left open between them |
| `share-locked` | concentric gold rings tunnelling inward to one bright keyhole of light, monastic, sealed, absolutely still. Gold, tan and deep black | radial: rings centred and tunnelling to a point in the middle distance |
| `share-topg` | a purple crown bursting with confetti and streamers, lightning bolts, championship ribbons, glossy purple orbs. Violet, purple and a thin line of gold | low horizon: the crown and the burst across the top quarter, wide open sky below |

Save each result as `share-<division>.webp`: `share-unranked`, `share-bottom`,
`share-mentzer`, `share-npc`, `share-full`, `share-prospect`,
`share-contender`, `share-menace`, `share-locked`, `share-topg`. `share-banner` is the fallback used when a
division has no file of its own: for that one drop the attachment and say
"teal and violet, confetti and sunburst rays over a bold gradient".

If a result comes back dark or photographic, add: "flat vector, cel shaded,
bright, cartoon, no photorealism, no 3D render." If two ranks come back
looking alike, the SHAPE line is being ignored: put it first.

**With no artwork at all** the card draws its own version of this: a diagonal
gradient in the week's state colour, a sunburst behind the crest, two soft
orbs and a confetti frame that never lands on the type. A banner replaces the
sunburst and orbs, not the layout.

---

## What happens to your files

Put them in `art/` named after the asset, then run `npm run art`. Ranks, cups,
marks and medals are downscaled to the size they appear at; share banners are
passed through as sent. Everything is written to `www/img/`, added to the
service worker's precache list, and the cache version is bumped. Nothing is
resized by the browser and nothing arrives late on screen.

Send a rough one first and I will put it in the app at every size it appears at,
so you can judge it where it actually lives rather than in a folder.
