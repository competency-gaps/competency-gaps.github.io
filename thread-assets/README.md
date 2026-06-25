# Thread assets

Standalone assets for the X/Twitter thread announcing the paper. **None of this
touches the main website** — it only borrows the top interactive demo
(`../concept_performance_map.html`) as a starting point.

## Files

- **`concept_map_soccer.gif`** — the deliverable. A looping recording of the
  concept map repurposed for the thread opener: an over-tested, well-performed
  "soccer" concept cluster (greens) contrasted with an under-tested,
  poorly-performed "refusing a request / holding boundaries" cluster (reds).
  The animation opens `match results` (χ_model = 0.884) then
  `refusing a request` (χ_model = 0.193), then loops.
- **`soccer_concept_map.html`** — a standalone copy of the demo with the concept
  set + scores swapped to tell the soccer-vs-boundaries story. Open it in a
  browser to interact with it directly.
- **`capture.mjs`** — Playwright script that loads the HTML, drives the clicks,
  and records a webm.
- **`build_gif.py`** — extracts frames from the webm and assembles the optimized,
  looping GIF (smooth fades preserved, static holds collapsed to keep it small).

## Regenerating the GIF

```bash
cd thread-assets
ln -sf /opt/node22/lib/node_modules node_modules   # make Playwright importable
node capture.mjs                                     # -> capture.webm
/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux -y -i capture.webm frames/f_%04d.png
python3 build_gif.py                                 # -> concept_map_soccer.gif
```
