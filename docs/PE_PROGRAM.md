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

## Safety numbers used in the code

Pressure bands in `program.js` (`PRESSURE_BANDS`), from consumer and vendor safety guidance:

| Band | Range | Note |
|---|---|---|
| Beginner | ≤ 10 kPa (2–3 inHg) | Where everyone starts |
| Intermediate | ≤ 17 kPa (3–5 inHg) | After weeks of comfortable sessions |
| Advanced | ≤ 24 kPa (5–7 inHg) | More marking; watch the skin |
| Hard ceiling | 34 kPa (10 inHg) | Never exceed, at any experience level |

Session guidance: beginners **10–20 minutes total**, split into **~10 minute sets** with a full release between them, 2–3 times a week. The app enforces the set breaks itself — at each boundary the timer pauses for 60 seconds and tells you to release and check the skin.

Stop signals coded into the guide and the discomfort flag: numbness, cold skin, dark discolouration that does not fade, petechiae, blisters, fluid ring, sharp pain, or an ache that lasts into the next day.

`planWarnings()` checks a planned session before it starts and objects to: pressure over the bands (harder if you have fewer than 12 logged sessions), pump sessions over 20 minutes for beginners or 40 for anyone, tension over 12 kg, stretch sessions over 2 hours, missing warm-up, and training with no rest day in 12+ days.

### Hydromax and other water pumps

A Hydromax has no gauge, so recording "8.0 kPa" would be a fabricated number. With **Pump type: Water** set, the app records a **1–5 intensity by feel** instead and never presents it as a pressure. Gauged air pumps get the real kPa/inHg slider.

## BPFSL as the session-level signal

Bone-pressed flaccid stretched length taken **before and after** a session is the fastest feedback available: it moves within one session, months before erect length does. Roughly **+5%** afterwards is the usual sign the tissue took the load. `bpfslVerdict()` reads it as:

- **< 1.5%** — not warm enough, not long enough, or too little tension
- **1.5–8%** — the response you want
- **> 8%** — a great session or a measurement inconsistency; suspicious if it comes with soreness

## The growth projection

`projection()` blends two things:

1. **Your own trend** — least-squares regression of BPEL against time across every check-in, with r².
2. **A volume-based prior** — what the literature would predict at your current weekly stretch and pump minutes. Traction response saturates around an hour a day (more hours did not buy proportional length in the trials), and the rate decays with time in training because gains front-load.

The blend weight `w` rises with the number of measurements, the span they cover, and how cleanly they fit a line — capped at 0.85. Early on the prior dominates, because two points cannot distinguish a trend from measurement noise. Later, your own data takes over.

Output is always a **range**, not a point, and the band widens as confidence drops. The confidence figure is shown on the stats screen alongside it. A projection that promised a single number, or a straight line forever, would be lying.

Reference rates in the prior: **0.42 cm/month** length at an hour a day of traction, decaying with `exp(-months/7)` toward a third of that; **0.07 cm/month** girth at ~20 min/day of pumping. Those integrate to roughly the trial figures over 3–6 months.

## Measurement discipline

Method inconsistency swamps real change, so:

- Check-ins are **monthly**, not weekly — weekly measuring produces noise to worry about.
- The form warns and asks for confirmation on any change over **1.5 cm** from the previous entry, because that is a typo or a different method, not a month of growth.
- Bone-pressed is the headline number; NBPEL is recorded but flagged as fat-pad dependent.

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
