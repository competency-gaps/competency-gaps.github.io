#!/usr/bin/env python3
"""Assemble extracted PNG frames into an optimized, looping GIF.

Smooth fades are preserved; long static holds are collapsed into single frames
with a longer display duration so the file stays small.
"""
import os, glob
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = sorted(glob.glob(os.path.join(HERE, "frames", "f_*.png")))
OUT = os.path.join(HERE, "concept_map_soccer.gif")

NATIVE_MS = 40           # 25 fps source -> 40 ms/frame
TARGET_W = 1100
PIXEL_DELTA = 24         # per-pixel intensity change counted as "different"
MERGE_THRESHOLD = 430    # < this many changed pixels -> static hold (pulse-dot only)
PALETTE_COLORS = 200

def changed_pixels(a, b):
    # The detail card is mostly white-on-white, so a mean diff is dominated by
    # the unchanged background. Counting pixels that actually moved separates
    # true holds (only the ~7px pulsing status dot changes) from card fades
    # (hundreds of text/border pixels change).
    diff = ImageChops.difference(a.convert("L"), b.convert("L"))
    mask = diff.point(lambda v: 255 if v > PIXEL_DELTA else 0)
    hist = mask.histogram()
    return hist[255]

# ---- load + downscale ----
imgs = []
for p in FRAMES:
    im = Image.open(p).convert("RGB")
    if im.width != TARGET_W:
        h = round(im.height * TARGET_W / im.width)
        im = im.resize((TARGET_W, h), Image.LANCZOS)
    imgs.append(im)

# ---- drop leading near-white (page still loading) frames ----
def near_white(im):
    g = im.convert("L")
    return (sum(i*c for i, c in enumerate(g.histogram())) / (im.width*im.height)) > 251
start = 0
while start < len(imgs) and near_white(imgs[start]):
    start += 1
imgs = imgs[start:]

# ---- merge frames that stay near-identical to the run's ANCHOR, accumulating
# duration. Comparing to the anchor (not the immediate predecessor) keeps slow
# fades smooth: during a fade each frame drifts from the anchor and breaks the
# run, while a true static hold collapses into a single long-duration frame. ----
merged = []            # list of (image, duration_ms)
anchor = imgs[0]
dur = NATIVE_MS
for cur in imgs[1:]:
    if changed_pixels(anchor, cur) < MERGE_THRESHOLD:
        dur += NATIVE_MS
    else:
        merged.append((anchor, dur))
        anchor = cur
        dur = NATIVE_MS
merged.append((anchor, dur))

print(f"{len(imgs)} frames -> {len(merged)} after merge")

# ---- shared palette so colors don't flicker between frames ----
# Build it from a few representative frames (idle + each card peak).
sample = Image.new("RGB", (TARGET_W, sum(m[0].height for m in merged[::max(1,len(merged)//6)])))
y = 0
for im, _ in merged[::max(1, len(merged)//6)]:
    sample.paste(im, (0, y)); y += im.height
pal_img = sample.quantize(colors=PALETTE_COLORS, method=Image.MEDIANCUT)

frames = [im.quantize(palette=pal_img, dither=Image.NONE) for im, _ in merged]
durations = [d for _, d in merged]

frames[0].save(
    OUT, save_all=True, append_images=frames[1:],
    duration=durations, loop=0, optimize=True, disposal=1,
)
print("wrote", OUT, f"{os.path.getsize(OUT)/1024:.0f} KB", "frames:", len(frames),
      "total ms:", sum(durations))
