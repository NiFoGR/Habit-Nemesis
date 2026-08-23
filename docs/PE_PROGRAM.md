# PE feature: what it tracks and what the numbers are based on

Notes behind `www/js/pe/`. Written down so the safety limits and the growth projection are traceable to something instead of invented.

## The honest summary

**Traction is the only method with real clinical trial data.** Everything else in this feature is tracked because it is part of the routine, not because there is a trial saying it adds centimetres.

| Method | Evidence | Treated in the app as |
|---|---|---|
| Traction (extender / manual stretching) | RCTs and open-label trials | The length driver |
| Pumping | No comparable length evidence; well documented risks | Girth and conditioning |

Jelqing and clamping were offered in the first version and have been removed: both rest on anecdote alone, and clamping in particular carries the highest injury risk of anything in common use. Sessions already logged against them still display under their own names rather than being relabelled.

### What traction actually produced

- **RestoreX, 30–90 min/day:** mean **+1.5 cm at 3 months**, **+1.6 cm at 6 months**.
- **Older extenders (AndroPenis, Golden Erect):** **+1.2–1.7 cm at 6 months**, but requiring **4–9 hours a day**.
- Meta-analyses put average gains **under 2 cm**, with most of the change in the **first 3 months**.

That is the ceiling this app is built around. It says so on the safety gate, in the guide, and in the projection copy, because the single biggest cause of quitting is expecting a different number.

## The target, and the two numbers that define it

- **Two hours of stretching a day** (`DAILY_STRETCH_GOAL_MS`), as much as can be managed up to that. Everything on the PE home screen, the Today hub and the warnings is measured against it.
- **10 kg of tension, hard ceiling**, the tension slider stops there, `store.js` refuses anything outside 0.5–10 on the way in, and the safety gate says why: length comes from time under tension, not from more load.

## Safety numbers used in the code

Session guidance for pumping: beginners **10–20 minutes total**, split into **~10 minute sets** with a full release between them, 2–3 times a week. The app enforces the set breaks itself, at each boundary the timer pauses for 60 seconds and tells you to release and check the skin.

Stop signals coded into the guide and the discomfort flag: numbness, cold skin, dark discolouration that does not fade, petechiae, blisters, fluid ring, sharp pain, or an ache that lasts into the next day.

`planWarnings()` checks a planned session before it starts and objects to: pump sessions over 20 minutes for beginners or 40 for anyone, a planned stretch that would put the day past 1.5× the two-hour target, and training with no rest day in 12+ days. It also notes when tension is at the 10 kg ceiling.

### No intensity on pumping

Pumping records **duration only**. A water pump has no gauge, so any pressure number would be invented, and a 1–5 "by feel" scale is the same invention with extra steps, it charts like data and is not. What is real is the clock and the enforced set breaks, so that is all that is stored. Pressure bands, the pressure/intensity settings and the pump-intensity stats were all removed; sessions logged by the older build still display whatever they recorded, read-only.

## BPFSL as the session-level signal

Bone-pressed flaccid stretched length taken **before and after** a session is the fastest feedback available: it moves within one session, months before erect length does. Roughly **+5%** afterwards is the usual sign the tissue took the load. `bpfslVerdict()` reads it as:

- **< 1.5%**, not warm enough, not long enough, or too little tension
- **1.5–8%**, the response you want
- **> 8%**, a great session or a measurement inconsistency; suspicious if it comes with soreness

## The growth projection

`projection()` blends two things:

1. **Your own trend**, least-squares regression of BPEL against time across every check-in, with r².
2. **A volume-based prior**, what the literature would predict at your current weekly stretch and pump minutes. Traction response saturates around an hour a day (more hours did not buy proportional length in the trials), and the rate decays with time in training because gains front-load.

The blend weight `w` rises with the number of measurements, the span they cover, and how cleanly they fit a line, capped at 0.85. Early on the prior dominates, because two points cannot distinguish a trend from measurement noise. Later, your own data takes over.

Output is always a **range**, not a point, and the band widens as confidence drops. The confidence figure is shown on the stats screen alongside it. A projection that promised a single number, or a straight line forever, would be lying.

Reference rates in the prior: **0.42 cm/month** length at an hour a day of traction, decaying with `exp(-months/7)` toward a third of that; **0.07 cm/month** girth at ~20 min/day of pumping. Those integrate to roughly the trial figures over 3–6 months.

## Measurement discipline

Every check-in records **five measurements, all required**:

| Key | What | Why it is in the set |
|---|---|---|
| `bpfsl` | BP flaccid stretched length | Moves first, the earliest signal there is |
| `bpel` | BP erect length | The headline number everything else is judged against |
| `nbpel` | NBP erect length | The gap to BPEL is your fat pad; moves with body weight, not growth |
| `eg` | Erect girth at the **thickest point** | Where pumping shows up first |
| `baseGirth` | Erect girth at the **very base** | Often moves independently of mid-shaft |

The check-in is one measurement per screen (`pe/measure.js`), each with a schematic diagram, the exact method, and why it is being asked for. Next stays disabled until the field holds a plausible number, none of them is optional, so none of them gets a skip button.

Method inconsistency swamps real change, so:

- Check-ins are **monthly**, not weekly, weekly measuring produces noise to worry about.
- The form warns on any change over **1.5 cm** from the previous entry, because that is a typo or a different method, not a month of growth. Anything outside 1–60 cm is refused outright.
- Bone-pressed is the headline number; NBPEL is recorded but flagged as fat-pad dependent.

### Progress photos

Photos are shot against a translucent **ghost of last month's photo** (`pe/camera.js`), then aligned: drag to pan, slider to zoom, with the ghost opacity adjustable through both stages. The transform is **baked into the saved image** rather than stored alongside it, so the gallery and the compare view need no extra state and what you aligned is what is stored. Angle and distance drift ruin a photo series faster than any real change appears, which is the whole reason the ghost exists.

## Reading the training back

Two charts on the stats screen exist to answer questions the totals cannot:

- **"Do the hours pay?"** (`volumeVsGain()`) pairs each gap between check-ins with the stretching that happened inside it, and plots average minutes a day against millimetres a month, with a trend line and Pearson's r. Gaps under a week are dropped, too short to separate growth from measuring noise. It is the one chart in the app that can argue *against* more volume, and it says so when r goes negative: bigger blocks with less gain usually means too much, too often.
- **Girth map** (`girthMap()`) plots thickest-point girth against base girth over time, with the difference between them called out. Pumping tends to move the middle before the base, so a widening gap is a real training signal rather than a curiosity.

## The gallery

Photos are **encrypted, not hidden**. AES-GCM with a 256-bit key derived from the PIN via PBKDF2-SHA256 at 250,000 iterations, stored in IndexedDB as ciphertext. The key exists only in memory while the gallery is open; it is dropped on a 2-minute idle timeout and immediately when the app is backgrounded, so decrypted images never sit in the app-switcher preview.

There is **no recovery**. A wrong PIN fails on the AES-GCM auth tag and leaks nothing; a forgotten PIN means the photos are gone. That is the trade-off that makes the encryption worth anything, and the UI says so before a PIN is set.

Photos are downscaled to 1600 px and re-encoded at JPEG q0.85 before encryption (~200–400 KB each), so years of monthly photos fit comfortably in the storage quota.

## Kegels during pumping

Pump sessions can run a kegel cadence at the hold length from the Kegels feature's current level. Completed cycles are logged to **both** features: they count toward the Kegels streak and lifetime totals, but are marked `countsForPromotion: false` and `estimated: true`, so they cannot level you up there. Levelling requires the measured press-and-hold reps, and cadence-following is not measurement.

## Data handling

State read from storage or from a backup file is untrusted. `store.js` coerces every field before use: enums against a whitelist, numbers into range, ids and dates against a pattern, arrays capped, unknown keys dropped. Settings are clamped into range; measurements outside a plausible 1-60 cm are dropped instead, because a clamped 500 cm reading would become a fabricated point in the middle of a chart. If what was read differs from what would be written, the cleaned version is written straight back.

Free text (notes) is stored as typed and escaped at render, since escaping on the way in would corrupt legitimate text. The app also ships a strict CSP with `script-src 'self'`, so an injected string cannot execute even if one ever slipped through.

Importing a backup made on a different device would leave photos here encrypted under a key nothing knows any more, so that case is detected and the user chooses which PIN survives.

## Sources

- [Correlation between duration of use and penile length gain with RestoreX](https://www.droracle.ai/articles/55072/is-there-a-correlation-between-duration-of-use-and)
- [Outcomes of RestoreX Penile Traction Therapy in Men With Peyronie's Disease (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S1743609520309395)
- [Outcomes of a Novel Penile Traction Device: Randomized, Single-Blind, Controlled Trial (Journal of Urology)](https://www.auajournals.org/doi/10.1097/JU.0000000000000245)
- [Effect of penile-extender device in increasing penile size in men with shortened penis (PubMed)](https://pubmed.ncbi.nlm.nih.gov/20102448/)
- [Penile traction therapy improves post-prostatectomy penile length (Urology Times)](https://www.urologytimes.com/view/penile-traction-therapy-improves-post-prostatectomy-penile-length-erectile-function)
- [Penis enlargement by traction: does it work and who should try it](https://factually.co/product-reviews/health-fitness/penis-enlargement-traction-methods-effects-safety-017072)
- [Safe maximum vacuum pressures for penis pumps](https://factually.co/fact-checks/health/safe-maximum-vacuum-pressures-penis-pumps-measurement-a89191)
- [Recommended techniques and pressure limits](https://factually.co/product-reviews/health/penis-pump-safety-pressure-guidelines-8c5d69)
- [How long should beginners use a penis pump per session](https://factually.co/fact-checks/health/penis-pump-usage-duration-beginners-safety-4726e1)
- [Guide to safe use and complications](https://zenhanger.com/blogs/penis-enlargement/dont-get-pumped-up-over-complications-your-guide-to-safe-use)
- [How long to use a penis pump safely each session (ScienceInsights)](https://scienceinsights.org/how-long-to-use-a-penis-pump-safely-each-session/)

*Trial figures come from the clinical literature; pressure and duration limits come from consumer safety guidance, which is where that guidance exists. None of this is medical advice, and the app says so in-product.*
