# Thread assets

Standalone assets for the X/Twitter thread announcing the paper. **None of this
touches the main website** — it only borrows the top interactive demo
(`../concept_performance_map.html`) as a starting point.

## Files

- **`concept_map_soccer.gif`** — the deliverable. A looping recording of the
  concept map repurposed for the thread opener. It contrasts an over-tested,
  well-performed "soccer" cluster with an under-tested, poorly-performed
  "refusing a request / holding boundaries" cluster, in two passes:
  1. **Benchmark Gaps** (coverage): opens `soccer-related scenarios`
     (χ_bench = 0.912, dark = heavily tested) then `refusing a request`
     (χ_bench = 0.087, near-white = barely tested).
  2. **Model Gaps** (performance): switches modes, the dots recolour, then opens
     the same two concepts — soccer green (χ_model = 0.884) vs refusing red
     (χ_model = 0.193).
  It resets to the Benchmark idle so the loop seam is clean.
- **`soccer_concept_map.html`** — a standalone copy of the demo with the concept
  set + scores swapped to tell the soccer-vs-boundaries story. Loads Helvetica
  Neue from `fonts/` and starts in Benchmark Gaps. The recording is driven via
  the `window.viz` hooks it exposes. Open it in a browser to interact directly.
- **`fonts/`** — Helvetica Neue (Regular/Medium/Bold), extracted from the
  collection committed at the repo root on `main`.
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
