/* CogWAM project page behaviour. No build step, no dependencies. */

(function () {
  "use strict";

  const CFG = window.COGWAM_SITE_CONFIG || {};

  // ---------------------------------------------------------------------
  // Link rendering — never fabricate a URL. A null config value renders a
  // disabled "Coming Soon" pill/button instead of a broken or fake link.
  // ---------------------------------------------------------------------

  function pillOrComingSoon(label, url) {
    if (url) {
      return `<a class="pill primary" href="${url}" target="_blank" rel="noopener">${label}</a>`;
    }
    return `<span class="pill disabled" title="Not yet public">${label}</span>`;
  }

  // Hero masthead pill buttons, icon + label. Kept as tiny inline SVGs
  // (currentColor) rather than an icon font, so the page has no extra
  // network dependency beyond the two Google Fonts already loaded.
  const ICONS = {
    paper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18c-4.5-1.5-4.5-10.5 0-12M15 6c4.5 1.5 4.5 10.5 0 12"/></svg>',
    model: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg>',
    quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 8c-2 1-3 3-3 5.5V17h4v-4H6c0-2 .8-3.2 2.2-4L7 8Zm9 0c-2 1-3 3-3 5.5V17h4v-4h-2c0-2 .8-3.2 2.2-4L16 8Z"/></svg>',
  };

  function heroPill(icon, label, url, { style, scrollTo } = {}) {
    if (scrollTo) {
      return `<a class="hero-btn ${style}" href="${scrollTo}">${ICONS[icon]}${label}</a>`;
    }
    if (url) {
      return `<a class="hero-btn ${style}" href="${url}" target="_blank" rel="noopener">${ICONS[icon]}${label}</a>`;
    }
    return `<span class="hero-btn disabled" title="Not yet public">${ICONS[icon]}${label} — Coming Soon</span>`;
  }

  function renderLinks() {
    const navActions = document.getElementById("nav-actions");
    const heroActions = document.getElementById("hero-actions");
    const footerLinks = document.getElementById("footer-links");

    if (navActions) {
      navActions.innerHTML = [
        pillOrComingSoon("arXiv", CFG.arxivUrl),
        pillOrComingSoon("Code", CFG.repoUrl),
        pillOrComingSoon("Model", CFG.modelUrl),
      ].join("");
    }
    if (heroActions) {
      heroActions.innerHTML = [
        heroPill("paper", "Paper", CFG.arxivUrl, { style: "primary" }),
        heroPill("code", "Code", CFG.repoUrl, { style: "tonal" }),
        heroPill("model", "Model", CFG.modelUrl, { style: "tonal" }),
        heroPill("quote", "BibTeX", null, { style: "tonal", scrollTo: "#citation" }),
      ].join("");
    }
    if (footerLinks) {
      footerLinks.innerHTML = [
        CFG.arxivUrl ? `<a href="${CFG.arxivUrl}">Paper</a>` : `<span>Paper</span>`,
        CFG.repoUrl ? `<a href="${CFG.repoUrl}">Code</a>` : `<span>Code</span>`,
        CFG.modelUrl ? `<a href="${CFG.modelUrl}">Model</a>` : `<span>Model</span>`,
      ].join("");
    }
  }

  // ---------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------

  async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`failed to load ${path}: ${res.status}`);
    return res.json();
  }

  // ---------------------------------------------------------------------
  // Hero clip strip — a small, fixed, hand-picked set. Autoplay muted loop
  // is acceptable here per spec (it's the teaser); everywhere else videos
  // stay paused until the visitor presses play.
  // ---------------------------------------------------------------------

  function renderHeroClips(robodojo, real) {
    const el = document.getElementById("hero-clips");
    if (!el) return;
    const picks = [
      real.find((v) => v.task === "place_objects" && v.success),
      robodojo.find((v) => v.task === "put_bottles_into_dustbin"),
      real.find((v) => v.task === "put_in_drawer" && v.success),
      robodojo.find((v) => v.task === "insert_tubes"),
    ].filter(Boolean);

    el.innerHTML = picks
      .map((v) => {
        const label = v.task_label || v.task;
        return `
        <div class="hero-clip">
          <video src="${v.web_path}" poster="${v.poster_path}" muted loop playsinline preload="metadata" autoplay></video>
          <div class="clip-label">${label}</div>
        </div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------------
  // Real-robot gallery — grouped by task, per spec's "Task 01 / large video"
  // then "Task 02 / two videos side by side" pattern.
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // Shared clip library — one mounted <video>, a dropdown, a filter-chip
  // row, and a thumbnail strip that all point at it. Used for both the Real
  // Robot and RoboDojo sections so neither ever renders dozens of <video>
  // elements at once. `groupKey` drives the filter chips (setting / capability
  // dimension); `keyOf` must return a value unique per clip; `renderMeta`
  // fills the info panel for whichever fields that clip set has.
  // ---------------------------------------------------------------------

  function renderClipLibrary({ clips, selectId, filterId, videoId, metaId, stripId, groupKey, keyOf, optionLabel, renderMeta }) {
    const select = document.getElementById(selectId);
    const filter = document.getElementById(filterId);
    const video = document.getElementById(videoId);
    const meta = document.getElementById(metaId);
    const strip = document.getElementById(stripId);
    if (!select || !video || !clips.length) return;

    const groupValues = [...new Set(clips.map((c) => c[groupKey]))];
    let activeGroup = "All";

    function optionsForGroup(group) {
      return group === "All" ? clips : clips.filter((c) => c[groupKey] === group);
    }

    function showClip(clip) {
      video.src = clip.web_path;
      video.poster = clip.poster_path;
      video.load();
      meta.innerHTML = renderMeta(clip);
      const key = keyOf(clip);
      strip.querySelectorAll(".clip-thumb").forEach((t) => {
        t.classList.toggle("active", t.dataset.key === key);
      });
    }

    function renderStrip(group) {
      const list = optionsForGroup(group);
      strip.innerHTML = list
        .map(
          (c) => `
        <div class="clip-thumb" data-key="${keyOf(c)}" title="${c.task_label}">
          <img src="${c.poster_path}" alt="${c.task_label}">
          <div class="clip-thumb-label">${c.task_label}</div>
        </div>`
        )
        .join("");
      strip.querySelectorAll(".clip-thumb").forEach((el) => {
        el.addEventListener("click", () => {
          const clip = list.find((c) => keyOf(c) === el.dataset.key);
          if (clip) {
            showClip(clip);
            select.value = clip.task;
          }
        });
      });
    }

    function renderSelect(group) {
      const list = optionsForGroup(group);
      const byTask = new Map();
      for (const c of list) if (!byTask.has(c.task)) byTask.set(c.task, c);
      select.innerHTML = [...byTask.values()].map((c) => `<option value="${c.task}">${optionLabel(c)}</option>`).join("");
    }

    filter.innerHTML =
      `<button class="dim-btn active" data-group="All">All</button>` +
      groupValues.map((g) => `<button class="dim-btn" data-group="${g}">${g}</button>`).join("");

    filter.querySelectorAll(".dim-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter.querySelectorAll(".dim-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeGroup = btn.dataset.group;
        renderSelect(activeGroup);
        renderStrip(activeGroup);
        const first = optionsForGroup(activeGroup)[0];
        if (first) showClip(first);
      });
    });

    select.addEventListener("change", () => {
      const list = optionsForGroup(activeGroup);
      const clip = list.find((c) => c.task === select.value) || list[0];
      if (clip) showClip(clip);
    });

    renderSelect(activeGroup);
    renderStrip(activeGroup);
    showClip(clips[0]);
  }

  function renderRealRobotLibrary(real) {
    renderClipLibrary({
      clips: real,
      selectId: "real-task-select",
      filterId: "real-setting-filter",
      videoId: "real-library-video",
      metaId: "real-library-meta",
      stripId: "real-library-strip",
      groupKey: "setting",
      keyOf: (c) => `${c.task}::${c.web_path}`,
      optionLabel: (c) => `${c.task_label} (${c.setting})`,
      renderMeta: (c) => `
        <dt>Task</dt><dd>${c.task_label}</dd>
        <dt>Setting</dt><dd>${c.setting}</dd>
        <dt>Outcome</dt><dd>${c.success ? "Success" : "Failure (challenging case)"}</dd>
        <dt>Duration</dt><dd>${c.duration_s.toFixed(0)}s</dd>
        <dt>Note</dt><dd>${c.caption}</dd>
      `,
    });
  }

  function renderRoboDojoLibrary(robodojo) {
    renderClipLibrary({
      clips: robodojo,
      selectId: "task-select",
      filterId: "dim-filter",
      videoId: "library-video",
      metaId: "library-meta",
      stripId: "library-strip",
      groupKey: "dimension",
      keyOf: (c) => c.web_path,
      optionLabel: (c) => `${c.task_label} (${c.dimension})`,
      renderMeta: (c) => `
        <dt>Task</dt><dd>${c.task_label}</dd>
        <dt>Dimension</dt><dd>${c.dimension}</dd>
        <dt>Episode</dt><dd>#${c.episode}${c.variation === "random" ? " (randomized layout)" : ""}</dd>
        <dt>Outcome</dt><dd>${c.success ? "Success" : c.variation === "random" ? "Failure &mdash; best partial credit among randomized attempts" : "Failure (challenging case)"} &middot; score ${c.score.toFixed(2)}</dd>
        <dt>Checkpoint</dt><dd>${c.checkpoint_label}</dd>
      `,
    });
  }


  // ---------------------------------------------------------------------
  // Results tables — literal numbers transcribed from the paper's own
  // LaTeX tables (tab/robodojo.tex, tab/bicoord_LH.tex, tab/real_world.tex,
  // tab/update_strategy.tex). Nothing here is computed by this page.
  // ---------------------------------------------------------------------

  function buildTable(el, { columns, groups }) {
    const thead = `<thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
    const rows = groups
      .map((g) => {
        const label = g.label ? `<tr class="group-label"><td colspan="${columns.length}">${g.label}</td></tr>` : "";
        const body = g.rows
          .map((r) => `<tr class="${r.highlight ? "highlight" : ""}">${r.cells.map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("");
        return label + body;
      })
      .join("");
    el.innerHTML = thead + `<tbody>${rows}</tbody>`;
  }

  function renderResultsTables() {
    // --- RoboDojo main table (tab/robodojo.tex) ---
    buildTable(document.getElementById("table-robodojo"), {
      columns: ["Method", "Generalization", "Precision", "Long-Horizon", "Memory", "Open", "Average"],
      groups: [
        {
          label: "w/ Prior Embodied Robot-Data Pre-training",
          rows: [
            { cells: ["X-VLA", "10.47 / 6.50", "18.32 / 12.00", "16.53 / 9.75", "4.76 / 3.56", "0.55 / 0.50", "10.13 / 6.52"] },
            { cells: ["InternVLA-A1.5", "10.36 / 7.00", "15.23 / 10.17", "23.80 / 13.75", "4.93 / 3.56", "1.43 / 1.42", "11.15 / 7.14"] },
            { cells: ["π₀.₅", "13.38 / 8.00", "12.40 / 5.50", "23.54 / 14.67", "5.78 / 4.56", "1.98 / 1.67", "11.41 / 6.91"] },
            { cells: ["Spatial Forcing", "14.12 / 9.50", "17.33 / 10.58", "23.26 / 14.58", "5.43 / 4.11", "1.78 / 1.58", "12.38 / 8.04"] },
            { cells: ["Hy-Embodied-0.5-VLA", "11.78 / 8.50", "13.81 / 8.00", "25.74 / 14.92", "13.37 / 12.11", "0.65 / 0.58", "13.07 / 8.80"] },
            { cells: ["Xiaomi-Robotics-1", "23.55 / 17.00", "26.69 / 18.83", "38.39 / 23.67", "7.81 / 6.56", "3.94 / 3.58", "20.07 / 13.93"] },
            { cells: ["GalaxeaVLA (G0.5)", "18.95 / 13.00", "28.25 / 20.42", "44.12 / 32.25", "8.61 / 7.33", "1.73 / 1.58", "20.23 / 14.88"] },
            { cells: ["DM0.5", "15.78 / 11.00", "24.82 / 16.75", "33.70 / 19.50", "47.74 / 47.44", "2.43 / 2.08", "24.90 / 19.34"] },
          ],
        },
        {
          label: "w/o Prior Embodied Robot-Data Pre-training",
          rows: [
            { cells: ["Fast-WAM", "2.34 / 1.00", "1.96 / 0.00", "9.14 / 5.17", "3.55 / 3.44", "0.42 / 0.42", "3.48 / 2.03"] },
            { cells: ["AHA-WAM", "5.79 / 3.00", "5.86 / 2.42", "8.61 / 2.67", "2.97 / 2.78", "0.88 / 0.83", "4.82 / 2.39"] },
            { cells: ["StarVLA-α", "3.94 / 2.50", "9.90 / 4.33", "14.15 / 6.50", "3.34 / 2.44", "0.68 / 0.58", "6.40 / 3.24"] },
            { cells: ["X-WAM", "7.39 / 3.00", "6.72 / 1.83", "17.47 / 9.08", "6.32 / 4.67", "0.57 / 0.25", "7.69 / 3.83"] },
            { cells: ["Fast-WAM + CogWAM Interface", "12.28 / 9.00", "19.61 / 13.50", "23.69 / 14.75", "9.17 / 8.00", "1.93 / 1.75", "13.33 / 9.40"] },
            { cells: ["<strong>CogWAM (Ours)</strong>", "15.53 / 12.17", "24.45 / 19.00", "28.14 / 19.00", "7.65 / 6.33", "2.05 / 2.00", "15.56 / 11.70"], highlight: true },
          ],
        },
      ],
    });

    // --- BiCoord (tab/bicoord_LH.tex) ---
    buildTable(document.getElementById("table-bicoord"), {
      columns: ["Method", "Clean Table", "Cook", "Exchange Mics", "Exchange Pots", "Match Blocks w/ Signs", "Put Objects Cabinet", "Average (18 Tasks)"],
      groups: [
        {
          rows: [
            { cells: ["RDT", "17.5 / 0.0", "31.0 / 9.0", "35.0 / 23.0", "96.0 / 92.0", "7.0 / 1.0", "49.0 / 31.0", "34.8 / 16.9"] },
            { cells: ["OpenVLA-OFT", "25.0 / 2.0", "25.0 / 10.0", "67.5 / 66.0", "56.0 / 53.0", "8.7 / 5.0", "49.5 / 26.0", "36.5 / 23.1"] },
            { cells: ["π₀", "46.2 / 6.0", "29.5 / 14.0", "59.5 / 52.0", "60.5 / 52.0", "18.7 / 8.0", "24.0 / 6.0", "43.2 / 27.2"] },
            { cells: ["π₀.₅", "61.5 / 24.0", "48.0 / 31.0", "62.0 / 55.0", "68.0 / 61.0", "15.0 / 6.0", "58.5 / 42.0", "50.8 / 35.6"] },
            { cells: ["<strong>CogWAM (Ours)</strong>", "80.0 / 50.0", "77.5 / 52.0", "56.5 / 49.0", "76.5 / 70.0", "17.3 / 7.0", "84.0 / 74.0", "58.0 / 43.8"], highlight: true },
          ],
        },
      ],
    });

    // --- Real world (tab/real_world.tex) ---
    buildTable(document.getElementById("table-realworld"), {
      columns: ["Basic Task", "Success", "Generalization Shift", "Success"],
      groups: [
        {
          rows: [
            { cells: ["Place Objects", "20 / 20", "Spatial Location", "21 / 30"] },
            { cells: ["Organize Utensils", "17 / 20", "Object Appearance", "20 / 30"] },
            { cells: ["Put in Drawer", "18 / 20", "Distractor", "17 / 30"] },
            { cells: ["Fill Pen Holder", "18 / 20", "Novel Objects", "14 / 30"] },
            { cells: ["Place in Bag", "16 / 20", "", ""] },
            { cells: ["Block Sorting", "5 / 20", "", ""] },
            { cells: ["<strong>Total</strong>", "<strong>94 / 120</strong>", "<strong>Total</strong>", "<strong>72 / 120</strong>"], highlight: true },
          ],
        },
      ],
    });

    // --- Update-strategy deployment cost (tab/update_strategy.tex) ---
    buildTable(document.getElementById("table-update-strategy"), {
      columns: ["Update strategy", "Calls / rollout", "Regenerations ↓", "Latency mean (ms) ↓", "Decoded tokens ↓", "Transition delay (ms) ↓"],
      groups: [
        {
          rows: [
            { cells: ["Synchronous", "65.4", "65.4", "927.8", "45", "152"] },
            { cells: ["Asynchronous (1 Hz)", "22.1", "22.1", "309.3", "45", "502"] },
            { cells: ["<strong>Event-triggered (ours)</strong>", "65.4", "<strong>4.0</strong>", "<strong>146.7</strong>", "<strong>0</strong>", "<strong>152</strong>"], highlight: true },
          ],
        },
      ],
    });
  }

  // ---------------------------------------------------------------------
  // BibTeX copy
  // ---------------------------------------------------------------------

  function wireCopyButton() {
    const btn = document.getElementById("copy-bibtex");
    const block = document.getElementById("bibtex-block");
    if (!btn || !block) return;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(block.textContent.trim());
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy BibTeX"), 1600);
      } catch (e) {
        btn.textContent = "Copy failed — select manually";
      }
    });
  }

  // ---------------------------------------------------------------------
  // Nav active-section highlight
  // ---------------------------------------------------------------------

  function wireNavHighlight() {
    const links = [...document.querySelectorAll(".nav-links a")];
    const sections = links.map((a) => document.querySelector(a.getAttribute("href")));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = sections.indexOf(entry.target);
          if (idx === -1) return;
          links[idx].classList.toggle("active", entry.isIntersecting);
        });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );
    sections.forEach((s) => s && observer.observe(s));
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------

  async function main() {
    renderLinks();
    wireCopyButton();
    wireNavHighlight();
    renderResultsTables();

    const [robodojo, real] = await Promise.all([
      loadJSON("data/robodojo_videos.json"),
      loadJSON("data/real_robot_videos.json"),
    ]);

    renderHeroClips(robodojo, real);
    renderRealRobotLibrary(real);
    renderRoboDojoLibrary(robodojo);
  }

  document.addEventListener("DOMContentLoaded", main);
})();
