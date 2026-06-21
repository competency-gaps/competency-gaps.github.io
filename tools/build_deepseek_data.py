#!/usr/bin/env python3
"""
Preprocess cached DeepSeek-R1-Distill-Llama-8B CG outputs into compact JSON
for the interactive website plots.

Source (read-only):
    ../comp-gaps-rebuttal/outputs/deepseek/

Reproduces the exact figure logic from comp-gaps-rebuttal/generate_appendix_figures.py
(same binning, ranges, ordering, category groupings) but emits tiny JSON
(binned counts) instead of 300-DPI PNGs.

Output:
    figures/results/deepseek_r1_distill_llama_8b/data/*.json
"""

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
SITE = HERE.parent
SRC = (SITE.parent / "comp-gaps-rebuttal" / "outputs" / "deepseek").resolve()
OUT = SITE / "figures" / "results" / "deepseek_r1_distill_llama_8b" / "data"
OUT.mkdir(parents=True, exist_ok=True)

COV = SRC / "coverage_analysis"
SCORES = SRC / "concept_scores"

# ---------------------------------------------------------------------------
# Constants mirrored from generate_appendix_figures.py
# ---------------------------------------------------------------------------
ORDERED_BENCHMARKS = [
    "agi_eval_en", "logicbench", "gsm8k", "natural_questions", "bbq",
    "social_iqa", "winogrande", "math", "vectara", "crows_pairs",
]

BENCHMARK_DISPLAY = {
    "agi_eval_en": "AGI Eval EN",
    "logicbench": "LogicBench",
    "gsm8k": "GSM8K",
    "natural_questions": "Natural Questions",
    "bbq": "BBQ",
    "social_iqa": "Social IQA",
    "winogrande": "WinoGrande",
    "math": "MATH",
    "vectara": "Vectara",
    "crows_pairs": "CROWS Pairs",
}

# Category groupings (mirrors GROUP_POSITIONS / GROUP_COLORS).
# First element of each (idx, row) tuple in the source is the flat grid index.
BENCH_CATEGORY = {
    "agi_eval_en": "REASONING",
    "logicbench": "REASONING",
    "social_iqa": "REASONING",
    "winogrande": "REASONING",
    "gsm8k": "MATH",
    "math": "MATH",
    "natural_questions": "FACTUALITY",
    "vectara": "FACTUALITY",
    "bbq": "ETHICS & BIAS",
    "crows_pairs": "ETHICS & BIAS",
}

GROUP_COLORS = {
    "REASONING":     "#ffecb3",
    "MATH":          "#c8e6c9",
    "FACTUALITY":    "#bbdefb",
    "ETHICS & BIAS": "#ffccbc",
}

DEFAULT_COLOR = "#1f77b4"
NBINS = 50


def display(b):
    return BENCHMARK_DISPLAY.get(b, b.replace("_", " ").title())


def write(name, obj):
    p = OUT / name
    with open(p, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(f"  wrote {p.relative_to(SITE)}  ({p.stat().st_size/1024:.1f} KB)")


def hist(values, lo, hi, nbins=NBINS):
    """Return {edges:[..n+1..], counts:[..n..]} over [lo,hi]."""
    counts, edges = np.histogram(values, bins=nbins, range=(lo, hi))
    return {
        "edges": [round(float(e), 6) for e in edges],
        "counts": [int(c) for c in counts],
    }


# ===========================================================================
def main():
    print(f"Source: {SRC}")
    print(f"Output: {OUT}")

    meta = {
        "model_display": "DeepSeek-R1-Distill-Llama-8B",
        "default_color": DEFAULT_COLOR,
        "group_colors": GROUP_COLORS,
        "ordered_benchmarks": ORDERED_BENCHMARKS,
        "display": {b: display(b) for b in ORDERED_BENCHMARKS},
        "category": BENCH_CATEGORY,
    }

    # --- load shared frames ------------------------------------------------
    print("Loading concept_cg_coverage_summary.csv ...")
    cov_sum = pd.read_csv(COV / "concept_cg_coverage_summary.csv")
    total_concepts = len(cov_sum)
    meta["total_concepts"] = int(total_concepts)

    print("Loading concept_saliency_details.csv ...")
    sal = pd.read_csv(COV / "concept_saliency_details.csv",
                      usecols=["concept_id", "benchmark", "saliency_score"])

    print("Loading concept_scores.csv ...")
    scores = pd.read_csv(SCORES / "concept_scores.csv")

    benchmarks = [b for b in ORDERED_BENCHMARKS if b in set(sal["benchmark"].unique())]
    meta["benchmarks"] = benchmarks
    write("meta.json", meta)

    # === 1. Overall coverage histogram (chi_bench, log-y) =================
    print("[1] overall coverage histogram")
    vals = cov_sum["cg_coverage"].to_numpy()
    vals = vals[np.isfinite(vals)]
    lo, hi = float(np.min(vals)), float(np.max(vals))
    write("overall_coverage_hist.json", {
        "xlabel": "chi_bench",
        "log_y": True,
        "min": lo, "max": hi,
        **hist(vals, lo, hi),
    })

    # === 2. Overall performance histogram (chi_model, median line) =======
    print("[2] overall performance histogram")
    mvals = scores["overall_score"].to_numpy(dtype=float)
    mvals = mvals[np.isfinite(mvals)]
    filt = mvals[(mvals > 0.01) & (mvals < 0.99)]
    median_val = float(np.median(filt))
    write("overall_performance_hist.json", {
        "xlabel": "chi_model",
        "log_y": False,
        "min": 0.01, "max": 0.99,
        "median": median_val,
        **hist(filt, 0.01, 0.99),
    })

    # === 3. Missing concepts % by benchmark ==============================
    print("[3] missing concepts % by benchmark")
    rows = []
    for b in benchmarks:
        n = sal[(sal["benchmark"] == b) & (sal["saliency_score"] > 0)]["concept_id"].nunique()
        pct = (1.0 - n / total_concepts) * 100.0
        rows.append({
            "benchmark": b, "display": display(b),
            "category": BENCH_CATEGORY[b], "color": GROUP_COLORS[BENCH_CATEGORY[b]],
            "missing_pct": round(pct, 2), "covered": int(n),
        })
    write("missing_by_benchmark.json", {"total_concepts": int(total_concepts), "bars": rows})

    # === 4. Benchmark-pair Jaccard overlap ===============================
    print("[4] benchmark Jaccard overlap")
    sets = {}
    pos = sal[sal["saliency_score"] > 0]
    for b in benchmarks:
        sets[b] = set(pos[pos["benchmark"] == b]["concept_id"].unique())
    matrix = []
    for a in benchmarks:
        row = []
        for c in benchmarks:
            inter = len(sets[a] & sets[c])
            union = len(sets[a] | sets[c])
            row.append(round(inter / union, 4) if union else 0.0)
        matrix.append(row)
    write("benchmark_jaccard.json", {
        "benchmarks": benchmarks,
        "display": [display(b) for b in benchmarks],
        "matrix": matrix,
    })

    # === 5. Per-benchmark coverage histograms (chi_bench, shared range) ===
    print("[5] per-benchmark coverage histograms")
    bench_pos = {}
    all_vals = []
    for b in benchmarks:
        v = sal[sal["benchmark"] == b]["saliency_score"].to_numpy(dtype=float)
        v = v[np.isfinite(v)]
        v = v[v > 0]
        bench_pos[b] = v
        all_vals.append(v)
    all_concat = np.concatenate(all_vals) if all_vals else np.array([0.0])
    cov_min = float(np.min(all_concat))
    cov_max = float(np.percentile(all_concat, 95))
    if cov_max <= cov_min:
        cov_max = cov_min + 1.0
    panels = []
    for b in benchmarks:
        panels.append({
            "benchmark": b, "display": display(b),
            "category": BENCH_CATEGORY[b], "color": GROUP_COLORS[BENCH_CATEGORY[b]],
            "n": int(len(bench_pos[b])),
            **hist(bench_pos[b], cov_min, cov_max),
        })
    write("coverage_hist_per_benchmark.json", {
        "xlabel": "chi_bench", "log_y": True,
        "min": cov_min, "max": cov_max, "panels": panels,
    })

    # === 6. Per-benchmark performance histograms (chi_model, median) =====
    print("[6] per-benchmark performance histograms")
    p_min, p_max = 0.02, 0.98
    panels = []
    for b in benchmarks:
        col = f"{b}_score"
        if col not in scores.columns:
            continue
        data = scores[col].to_numpy(dtype=float)
        data = data[np.isfinite(data)]
        filt = data[(data > p_min) & (data < p_max)]
        if len(filt) == 0:
            filt = data
        med = float(np.median(filt)) if len(filt) else 0.0
        panels.append({
            "benchmark": b, "display": display(b),
            "category": BENCH_CATEGORY[b], "color": GROUP_COLORS[BENCH_CATEGORY[b]],
            "n": int(len(filt)), "median": round(med, 4),
            **hist(filt, p_min, p_max),
        })
    write("performance_hist_per_benchmark.json", {
        "xlabel": "chi_model", "log_y": False,
        "min": p_min, "max": p_max, "panels": panels,
    })

    print("Done.")


if __name__ == "__main__":
    main()
