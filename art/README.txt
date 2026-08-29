Artwork sources.

Drop a file here named after the asset it becomes and run `npm run art`. It is
downscaled to the size that asset appears at, written to www/img/, added to the
service worker's precache list, and the manifest the app reads is regenerated.

  rank-unranked   rank-0-bottom   rank-1-npc    rank-2-prospect
  rank-3-contender  rank-4-menace  rank-5-locked  rank-6-topg
  cup-winter   cup-spring   cup-autumn   cup-blank
  mark-habits  mark-arena   mark-kegels  mark-pe  mark-bible  mark-breathe
  feat-<id>    one per feat, ids are in www/js/arena/feats.js

WebP or PNG, transparent, square. WebP is passed through untouched and is about
a quarter the size, so send it where your tool can export it. PNG is decoded and
resized here; it must be 8-bit RGB or RGBA and not interlaced.

Nothing in here ships. www/img/ is what ships.

docs/ART.md says what each asset has to say and the sizes to send.
