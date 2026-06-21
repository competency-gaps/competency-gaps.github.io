/* ============================================================
   Interactive Competency-Gaps plots — DeepSeek-R1-Distill-Llama-8B
   Renders the cached compact JSON (figures/results/.../data/*.json)
   into responsive Plotly charts that match the site design.

   Public API (all return Promises):
     CGPlots.overallHistogram(elId, jsonUrl, {kind})
     CGPlots.missingBar(elId, jsonUrl)
     CGPlots.jaccard(elId, jsonUrl)
     CGPlots.perBenchmarkGrid(elId, jsonUrl, {kind})
   ============================================================ */
(function (global) {
  "use strict";

  const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const BLUE = "#1f77b4";
  const AXIS = "#444";
  const GRID = "#ececec";

  const BASE_CONFIG = {
    displayModeBar: false,
    responsive: true,
    scrollZoom: false,
    doubleClick: false,
  };

  function fontLayout(extra) {
    return Object.assign(
      {
        font: { family: FONT, size: 13, color: "#111" },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        margin: { l: 56, r: 16, t: 16, b: 48 },
        hoverlabel: { font: { family: FONT, size: 12 }, bgcolor: "#111", bordercolor: "#111" },
        bargap: 0.04,
      },
      extra || {}
    );
  }

  // bin edges [n+1] -> centers/widths [n]
  function bins(d) {
    const e = d.edges, c = d.counts;
    const x = [], w = [], lo = [], hi = [];
    for (let i = 0; i < c.length; i++) {
      x.push((e[i] + e[i + 1]) / 2);
      w.push(e[i + 1] - e[i]);
      lo.push(e[i]);
      hi.push(e[i + 1]);
    }
    return { x, w, lo, hi, c };
  }

  function fmt(v) {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    if (Math.abs(v) >= 10) return Math.round(v).toString();
    if (Math.abs(v) >= 1) return v.toFixed(2);
    return v.toPrecision(2);
  }

  function histTrace(d, color) {
    const b = bins(d);
    const cust = b.lo.map((l, i) => [fmt(l), fmt(b.hi[i])]);
    return {
      type: "bar",
      x: b.x,
      y: b.c,
      width: b.w,
      marker: {
        color: color || BLUE,
        opacity: 0.78,
        line: { color: "#000", width: 0.6 },
      },
      customdata: cust,
      hovertemplate:
        "<b>%{customdata[0]} – %{customdata[1]}</b><br>%{y:,} concepts<extra></extra>",
    };
  }

  function medianShape(x, ymaxlog) {
    return {
      type: "line",
      x0: x, x1: x, yref: "paper", y0: 0, y1: 1,
      line: { color: "#e23b2e", width: 2.4, dash: "dash" },
    };
  }

  function getJSON(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error("Failed to load " + url);
      return r.json();
    });
  }

  function setLoading(el) {
    el.innerHTML = '<div class="cg-loading">loading…</div>';
  }
  function setError(el, e) {
    el.innerHTML =
      '<div class="cg-loading" style="color:#c0392b">could not load chart</div>';
    console.error(e);
  }

  // ---------- xlabel rendering with subscript ----------
  function chiLabel(key) {
    if (key === "chi_bench") return "χ<sub>bench</sub>";
    if (key === "chi_model") return "χ<sub>model</sub>";
    return key;
  }

  // ========================================================
  // 1. Overall histogram (coverage = log-y, performance = median line)
  // ========================================================
  function overallHistogram(elId, jsonUrl, opts) {
    opts = opts || {};
    const el = document.getElementById(elId);
    if (!el) return Promise.resolve();
    setLoading(el);
    return getJSON(jsonUrl)
      .then((d) => {
        const trace = histTrace(d, BLUE);
        const yaxis = {
          title: { text: d.log_y ? "# Concepts (log)" : "# Concepts", font: { size: 14 } },
          gridcolor: GRID, zeroline: false, color: AXIS,
        };
        if (d.log_y) yaxis.type = "log";
        const layout = fontLayout({
          xaxis: {
            title: { text: chiLabel(d.xlabel), font: { size: 16 } },
            range: [d.min, d.max], gridcolor: GRID, zeroline: false, color: AXIS,
          },
          yaxis: yaxis,
          shapes: [],
          annotations: [],
        });
        if (typeof d.median === "number") {
          layout.shapes.push(medianShape(d.median));
          layout.annotations.push({
            x: d.median, y: 1, yref: "paper", yanchor: "bottom",
            text: "median " + d.median.toFixed(3),
            showarrow: false, font: { size: 12, color: "#e23b2e" },
            xanchor: d.median > (d.min + d.max) / 2 ? "right" : "left",
          });
        }
        el.innerHTML = "";
        return global.Plotly.newPlot(el, [trace], layout, BASE_CONFIG);
      })
      .catch((e) => setError(el, e));
  }

  // ========================================================
  // 2. Missing-concepts % by benchmark (bars colored by category)
  // ========================================================
  function missingBar(elId, jsonUrl) {
    const el = document.getElementById(elId);
    if (!el) return Promise.resolve();
    setLoading(el);
    return getJSON(jsonUrl)
      .then((d) => {
        const bars = d.bars;
        const x = bars.map((b) => b.display);
        const y = bars.map((b) => b.missing_pct);
        const trace = {
          type: "bar",
          x: x, y: y,
          marker: { color: BLUE, opacity: 0.78, line: { color: "#000", width: 0.6 } },
          text: y.map((v) => v.toFixed(1) + "%"),
          textposition: "outside",
          textfont: { size: 12, family: FONT },
          customdata: bars.map((b) => [b.category, b.covered]),
          hovertemplate:
            "<b>%{x}</b><br>%{customdata[0]}<br>%{y:.1f}% of dictionary untested<br>%{customdata[1]:,} concepts covered<extra></extra>",
          cliponaxis: false,
        };
        const layout = fontLayout({
          margin: { l: 56, r: 16, t: 16, b: 96 },
          xaxis: { tickangle: -40, color: AXIS, automargin: true },
          yaxis: {
            title: { text: "Missing Concepts (%)", font: { size: 14 } },
            range: [0, 100], gridcolor: GRID, zeroline: false, color: AXIS,
          },
        });
        el.innerHTML = "";
        return global.Plotly.newPlot(el, [trace], layout, BASE_CONFIG);
      })
      .catch((e) => setError(el, e));
  }

  // ========================================================
  // 3. Benchmark-pair Jaccard overlap heatmap
  // ========================================================
  function jaccard(elId, jsonUrl) {
    const el = document.getElementById(elId);
    if (!el) return Promise.resolve();
    setLoading(el);
    return getJSON(jsonUrl)
      .then((d) => {
        const labels = d.display;
        const z = d.matrix;
        const text = z.map((row) => row.map((v) => v.toFixed(2)));
        const trace = {
          type: "heatmap",
          x: labels, y: labels, z: z,
          xgap: 2, ygap: 2,
          colorscale: [
            [0, "#f3f6fb"], [0.25, "#bcd3ea"], [0.5, "#7fb0d8"],
            [0.75, "#3d7fbf"], [1, "#1f4e79"],
          ],
          zmin: 0, zmax: 1,
          colorbar: {
            title: { text: "Jaccard", side: "right", font: { size: 12 } },
            thickness: 14, len: 1, lenmode: "fraction",
            y: 0.5, yanchor: "middle", tickfont: { size: 11 },
            outlinewidth: 0,
          },
          text: text,
          texttemplate: "%{text}",
          textfont: { size: 10, family: FONT },
          hovertemplate: "<b>%{y}</b> ∩ <b>%{x}</b><br>Jaccard = %{z:.3f}<extra></extra>",
        };
        const layout = fontLayout({
          margin: { l: 118, r: 10, t: 8, b: 104 },
          xaxis: { tickangle: -40, color: AXIS, automargin: true },
          yaxis: { autorange: "reversed", color: AXIS, automargin: true },
        });
        el.innerHTML = "";
        return global.Plotly.newPlot(el, [trace], layout, BASE_CONFIG);
      })
      .catch((e) => setError(el, e));
  }

  // ========================================================
  // 4. Per-benchmark small-multiples, grouped by category
  // ========================================================
  function perBenchmarkGrid(elId, jsonUrl, opts) {
    opts = opts || {};
    const el = document.getElementById(elId);
    if (!el) return Promise.resolve();
    setLoading(el);
    return getJSON(jsonUrl)
      .then((d) => {
        // group panels by category, preserving panel order
        const order = [];
        const groups = {};
        d.panels.forEach((p) => {
          if (!groups[p.category]) {
            groups[p.category] = { color: p.color, panels: [] };
            order.push(p.category);
          }
          groups[p.category].panels.push(p);
        });

        el.innerHTML = "";
        const grid = document.createElement("div");
        grid.className = "cg-grid";
        el.appendChild(grid);

        const renderQueue = [];

        order.forEach((cat) => {
          const g = groups[cat];
          const groupEl = document.createElement("div");
          groupEl.className = "cg-group";
          groupEl.style.background = hexToRgba(g.color, 0.32);
          // On desktop the grid mirrors the original 2x5 figure: REASONING is a
          // 2x2 block (flex grows by 2, 2 inner columns), the others are single
          // columns. CSS consumes --cg-cols; mobile collapses to one column.
          const cols = g.panels.length > 2 ? 2 : 1;
          groupEl.style.setProperty("--cg-cols", cols);
          const title = document.createElement("div");
          title.className = "cg-group-title";
          title.textContent = cat;
          groupEl.appendChild(title);

          const cells = document.createElement("div");
          cells.className = "cg-group-cells";
          groupEl.appendChild(cells);
          grid.appendChild(groupEl);

          g.panels.forEach((p) => {
            const cell = document.createElement("div");
            cell.className = "cg-cell";
            const t = document.createElement("div");
            t.className = "cg-cell-title";
            t.textContent = p.display;
            cell.appendChild(t);
            if (typeof p.median === "number") {
              const sub = document.createElement("div");
              sub.className = "cg-cell-sub";
              sub.textContent = "median " + p.median.toFixed(3);
              cell.appendChild(sub);
            }
            const plotDiv = document.createElement("div");
            cell.appendChild(plotDiv);
            cells.appendChild(cell);
            renderQueue.push({ plotDiv, panel: p });
          });
        });

        // render each small histogram
        const log_y = d.log_y;
        renderQueue.forEach(({ plotDiv, panel }) => {
          const trace = histTrace(panel, BLUE);
          // Keep the y axis labels tiny: compact SI ticks ("10k", "2k"), no
          // log minor labels, a small fixed left margin (no automargin growth).
          const yaxis = {
            gridcolor: GRID, zeroline: false, color: AXIS,
            tickfont: { size: 9 }, automargin: false, ticklen: 0,
          };
          if (log_y) {
            yaxis.type = "log";
            yaxis.dtick = 1;            // decade ticks only — drops the 5/2 clutter
            yaxis.exponentformat = "SI"; // 10, 100, 1k, 10k
          } else {
            yaxis.tickformat = "~s";     // 500, 1k, 2k
            yaxis.nticks = 4;
          }
          const layout = fontLayout({
            height: 188,
            margin: { l: 26, r: 8, t: 6, b: 34 },
            bargap: 0.03,
            xaxis: {
              title: { text: chiLabel(d.xlabel), font: { size: 12 } },
              range: [d.min, d.max], gridcolor: GRID, zeroline: false,
              color: AXIS, tickfont: { size: 10 }, nticks: 4,
            },
            yaxis: yaxis,
            shapes: [],
          });
          if (typeof panel.median === "number") {
            layout.shapes.push(medianShape(panel.median));
          }
          global.Plotly.newPlot(plotDiv, [trace], layout, BASE_CONFIG);
        });
      })
      .catch((e) => setError(el, e));
  }

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ========================================================
  // 5. Data-point examples (real benchmark items that fired a concept
  //    and that the model got wrong) — rendered as responsive cards.
  // ========================================================
  function dataPointExamples(elId, jsonUrl) {
    const el = document.getElementById(elId);
    if (!el) return Promise.resolve();
    setLoading(el);
    return getJSON(jsonUrl)
      .then((items) => {
        el.innerHTML = "";
        const row = document.createElement("div");
        row.className = "cg-dp-row";
        el.appendChild(row);
        items.forEach((it) => {
          const card = document.createElement("div");
          card.className = "cg-dp-card";

          const head = document.createElement("div");
          head.className = "cg-dp-head";
          head.innerHTML =
            '<span class="cg-dp-concept"><tt>(' + it.concept_id + ')</tt> ' +
            escapeHtml(it.concept) + "</span>" +
            '<span class="cg-dp-bench">' + escapeHtml(it.benchmark_display) + "</span>";
          card.appendChild(head);

          const body = document.createElement("div");
          body.className = "cg-dp-body";
          // Escape currency dollar signs ("$100") so MathJax doesn't mistake
          // them for inline-math delimiters; real LaTeX ($\triangle$) is kept.
          // The page's MathJax config has processEscapes:true, so "\$" renders
          // as a literal dollar sign.
          body.textContent = it.prompt.replace(/\$(?=\d)/g, "\\$");
          card.appendChild(body);

          const foot = document.createElement("div");
          foot.className = "cg-dp-foot";
          foot.innerHTML =
            '<span class="cg-dp-wrong">✗ answered incorrectly</span>' +
            '<span class="cg-dp-stat">concept saliency ' + it.saliency.toFixed(3) +
            " · <i>χ</i><sub>model</sub> = " + it.chi_model.toFixed(3) + "</span>";
          card.appendChild(foot);

          row.appendChild(card);
        });
        // re-typeset LaTeX in the injected prompts (MathJax v2)
        if (global.MathJax && global.MathJax.Hub) {
          global.MathJax.Hub.Queue(["Typeset", global.MathJax.Hub, el]);
        }
      })
      .catch((e) => setError(el, e));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  global.CGPlots = {
    overallHistogram,
    missingBar,
    jaccard,
    perBenchmarkGrid,
    dataPointExamples,
  };
})(window);
