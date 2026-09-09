# habit-nemesis-widgets

Three Android home screen widgets, RemoteViews only. No Compose, no Glance,
no timer: the app pushes every update.

- Fixture, 4x2. Crest, division, two lanes on one scale, the verdict.
- Today, 2x2. The owed ring and the fraction.
- Habits, 4x2 and resizable. The last four days of the grid.

## The snapshot

One JSON string in SharedPreferences file `habitnemesis.widgets`, key
`snapshot`. The web app writes it on every change. Keep it under 8KB.

```json
{
  "v": 1,
  "today": "2026-09-09",
  "days": ["2026-09-03", "..."],
  "dayLabels": ["W", "..."],
  "rows": [
    { "id": "h_abc", "name": "Run", "colour": "#fb923c", "kind": "yesno", "marks": [1, 0, -1, null] },
    { "id": "h_def", "name": "Water", "colour": "#38bdf8", "kind": "number", "target": 2, "marks": [2, 1.5, null, null] }
  ],
  "owed": { "done": 2, "total": 3 },
  "fixture": { "week": "7 - 13 Sep", "you": 57, "them": 61, "themName": "Last Month You", "state": "behind", "daysLeft": 5, "division": "NPC", "crest": "rank-npc" }
}
```

- `marks` is aligned with `days`, oldest first, the last one today.
- `1` done, `0` a recorded miss, `-1` a skip, `null` nothing recorded.
- Any `kind` other than `yesno` holds the logged value, done at or above `target`.
- `fixture.state` is `ahead`, `behind` or `level`. `fixture` is absent before a match.
- `crest` names a file at `assets/public/img/<crest>.webp`. Missing hides the image.
- Every key is optional. A missing key is absence, never a crash.

## The plugin

`window.Capacitor.Plugins.HabitWidgets`, two methods.

- `writeSnapshot({ json })` stores the string and redraws every placed widget.
  Resolves `{ ok: true }`.
- `drainQueue()` resolves `{ marks: [...] }` and clears the queue.

## The queue

Tapping today's cell of a `yesno` row flips it on the widget, then appends to
SharedPreferences key `queue`, a JSON array string:

```json
[{ "habitId": "h_abc", "day": "2026-09-09", "value": 1, "at": 1757404800000 }]
```

- `value` is `1` for done and `null` for cleared.
- `at` is epoch millis.
- Oldest first. Capped at 500 entries, oldest dropped.
- The app owns the truth: drain on launch and on resume, apply, then write a
  fresh snapshot back.
