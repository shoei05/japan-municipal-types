// 色は3系統（都市＝青、町村＝橙、大都市制度＝青緑）。系統内の濃淡で人口区分か産業構造を表す。
const RAMP = {
  都市: ["#86b6ef", "#5598e7", "#256abf", "#104281"],
  町村: ["#f2a171", "#e87d40", "#cc5a1c", "#a14212", "#6e2c0a"],
};
const SPECIAL = [
  { kubun: "政令指定都市", color: "#0b5e44" },
  { kubun: "特別区", color: "#16855f" },
  { kubun: "中核市", color: "#2fa57c" },
  { kubun: "施行時特例市", color: "#5fc29d" },
];
const NONE = "#c9c7bf";
const DIM = "#e8e6e0";

const ROMAN = ["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"];
const POP = {
  都市: ["", "5万人未満", "5万〜10万人未満", "10万〜15万人未満", "15万人以上"],
  町村: ["", "5千人未満", "5千〜1万人未満", "1万〜1.5万人未満", "1.5万〜2万人未満", "2万人以上"],
};
const IND = {
  都市: {
    3: "Ⅱ次・Ⅲ次90%以上、Ⅲ次65%以上",
    2: "Ⅱ次・Ⅲ次90%以上、Ⅲ次65%未満",
    1: "Ⅱ次・Ⅲ次90%未満、Ⅲ次55%以上",
    0: "Ⅱ次・Ⅲ次90%未満、Ⅲ次55%未満",
  },
  町村: {
    2: "Ⅱ次・Ⅲ次80%以上、Ⅲ次60%以上",
    1: "Ⅱ次・Ⅲ次80%以上、Ⅲ次60%未満",
    0: "Ⅱ次・Ⅲ次80%未満",
  },
};
const IND_HEAD = {
  都市: { 3: "Ⅲ次65%以上", 2: "Ⅲ次65%未満", 1: "Ⅲ次55%以上", 0: "Ⅲ次55%未満" },
  町村: { 2: "Ⅲ次60%以上", 1: "Ⅲ次60%未満", 0: "80%未満" },
};
const IND_GROUP = { 都市: ["Ⅱ次・Ⅲ次90%以上", "Ⅱ次・Ⅲ次90%未満"], 町村: ["Ⅱ次・Ⅲ次80%以上", ""] };
const MAX_POP = { 都市: 4, 町村: 5 };
const MAX_IND = { 都市: 3, 町村: 2 };

let mode = "pop";
let selected = null;
let features = [];
let map;

const kubunOf = (kind, pop, ind) => `${kind}${ROMAN[pop]}－${ind}`;

function colorOf(kind, pop, ind) {
  const sp = SPECIAL.find((s) => s.kubun === kind);
  if (sp) return sp.color;
  if (!RAMP[kind]) return NONE;
  if (mode === "pop") return RAMP[kind][pop - 1];
  // 産業構造は0〜3（町村は0〜2）を同じランプの両端に割り付ける
  const r = RAMP[kind];
  const idx = Math.round((ind / MAX_IND[kind]) * (r.length - 1));
  return r[idx];
}

function describe(p) {
  if (!p.kubun) return "類型の設定なし";
  if (!RAMP[p.kind]) return p.kubun;
  return `${p.kubun}（人口${POP[p.kind][p.pop]}、${IND[p.kind][p.ind]}）`;
}

function fillExpression() {
  const pairs = [];
  const seen = new Set();
  for (const f of features) {
    const p = f.properties;
    if (!p.kubun || seen.has(p.kubun)) continue;
    seen.add(p.kubun);
    const c = colorOf(p.kind, +p.pop, +p.ind);
    pairs.push(p.kubun, selected && selected !== p.kubun ? DIM : c);
  }
  return ["match", ["get", "kubun"], ...pairs, selected ? DIM : NONE];
}

function counts() {
  const c = {};
  for (const f of features) {
    const k = f.properties.kubun;
    if (k) c[k] = (c[k] || 0) + 1;
  }
  return c;
}

function renderLegend() {
  const c = counts();
  const el = document.getElementById("legend");
  const cell = (kubun, color) => {
    const n = c[kubun] || 0;
    if (!n) return `<td><button class="cell" disabled>−</button></td>`;
    const cls = ["cell", selected === kubun ? "sel" : "", selected && selected !== kubun ? "dim" : ""].join(" ");
    return `<td><button class="${cls}" data-kubun="${kubun}" style="background:${color}" aria-pressed="${selected === kubun}" title="${kubun}"><span class="n">${n}</span></button></td>`;
  };

  let html = `<div class="special">` + SPECIAL.map((s) => {
    const cls = ["cell", selected === s.kubun ? "sel" : "", selected && selected !== s.kubun ? "dim" : ""].join(" ");
    return `<button class="${cls}" data-kubun="${s.kubun}" aria-pressed="${selected === s.kubun}"><span class="sw" style="background:${s.color}"></span>${s.kubun}（${c[s.kubun] || 0}）</button>`;
  }).join("") + `</div>`;

  for (const kind of ["都市", "町村"]) {
    const inds = Array.from({ length: MAX_IND[kind] + 1 }, (_, i) => MAX_IND[kind] - i);
    const [g1, g2] = IND_GROUP[kind];
    const span1 = 2;
    html += `<table class="grid"><colgroup><col class="rh"></colgroup><caption>${kind}（${Object.keys(c).filter((k) => k.startsWith(kind)).reduce((a, k) => a + c[k], 0)}団体）</caption><thead>`;
    html += `<tr><th></th><th colspan="${span1}">${g1}</th><th colspan="${inds.length - span1}">${g2}</th></tr>`;
    html += `<tr><th></th>${inds.map((i) => `<th>${i}<br>${IND_HEAD[kind][i]}</th>`).join("")}</tr></thead><tbody>`;
    for (let p = 1; p <= MAX_POP[kind]; p++) {
      html += `<tr><th>${ROMAN[p]}<br><small>${POP[kind][p]}</small></th>${inds.map((i) => cell(kubunOf(kind, p, i), colorOf(kind, p, i))).join("")}</tr>`;
    }
    html += `</tbody></table>`;
  }
  el.innerHTML = html;
  el.querySelectorAll("button[data-kubun]").forEach((b) =>
    b.addEventListener("click", () => select(selected === b.dataset.kubun ? null : b.dataset.kubun))
  );
  document.getElementById("clear").hidden = !selected;
}

function renderList() {
  const box = document.getElementById("list");
  if (!selected) { box.hidden = true; return; }
  const items = features.filter((f) => f.properties.kubun === selected)
    .sort((a, b) => a.properties.code.localeCompare(b.properties.code));
  document.getElementById("list-title").textContent = `${selected}の団体（${items.length}）`;
  const ol = document.getElementById("list-body");
  ol.innerHTML = items.map((f) =>
    `<li><button data-code="${f.properties.code}">${f.properties.pref} ${f.properties.name}${f.properties.nonsel ? " ※" : ""}</button></li>`
  ).join("");
  ol.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => focusCode(b.dataset.code)));
  box.hidden = false;
}

function select(kubun) {
  selected = kubun;
  map.setPaintProperty("muni-fill", "fill-color", fillExpression());
  renderLegend();
  renderList();
}

function setMode(m) {
  mode = m;
  document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === m));
  map.setPaintProperty("muni-fill", "fill-color", fillExpression());
  renderLegend();
}

function bbox(geom) {
  let b = [180, 90, -180, -90];
  const walk = (c) => {
    if (typeof c[0] === "number") {
      b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])];
    } else c.forEach(walk);
  };
  walk(geom.coordinates);
  return b;
}

function showDetail(p) {
  const el = document.getElementById("detail");
  el.innerHTML = `<div class="name">${p.name}</div><dl>
    <dt>都道府県</dt><dd>${p.pref}</dd>
    <dt>団体コード</dt><dd>${p.code || "−"}</dd>
    <dt>類型</dt><dd>${describe(p)}</dd>
    ${p.nonsel ? "<dt>備考</dt><dd>指数表の選定外（※）</dd>" : ""}
  </dl>`;
  el.hidden = false;
}

function focusCode(code) {
  const f = features.find((x) => x.properties.code === code);
  if (!f) return;
  const b = bbox(f.geometry);
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 80, maxZoom: 8.5, duration: 600 });
  map.setFilter("muni-picked", ["==", ["get", "code"], code]);
  showDetail(f.properties);
}

async function init() {
  const [munis, prefs] = await Promise.all([
    fetch("data/munis.geojson").then((r) => r.json()),
    fetch("data/prefs.geojson").then((r) => r.json()),
  ]);
  features = munis.features;

  map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {},
      layers: [{ id: "bg", type: "background", paint: { "background-color": "#f4f3ef" } }],
    },
    bounds: [[123, 24.5], [146, 45.6]],
    fitBoundsOptions: { padding: 20 },
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    preserveDrawingBuffer: true,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: "総務省「類似団体別市町村財政指数表」、国土数値情報（行政区域）を加工",
  }));

  map.on("load", () => {
    map.addSource("munis", { type: "geojson", data: munis, generateId: true });
    map.addSource("prefs", { type: "geojson", data: prefs });
    map.addLayer({ id: "muni-fill", type: "fill", source: "munis", paint: { "fill-color": fillExpression() } });
    map.addLayer({
      id: "muni-line", type: "line", source: "munis",
      paint: { "line-color": "#fcfcfb", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.15, 8, 0.8, 11, 1.5] },
    });
    map.addLayer({
      id: "pref-line", type: "line", source: "prefs",
      paint: { "line-color": "#52514e", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 9, 1.4] },
    });
    map.addLayer({
      id: "muni-hover", type: "line", source: "munis",
      paint: { "line-color": "#0b0b0b", "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2, 0] },
    });
    map.addLayer({
      id: "muni-picked", type: "line", source: "munis", filter: ["==", ["get", "code"], ""],
      paint: { "line-color": "#0b0b0b", "line-width": 2.5 },
    });

    const tip = document.getElementById("tip");
    let hoverId = null;
    map.on("mousemove", "muni-fill", (e) => {
      const f = e.features[0];
      if (hoverId !== null) map.setFeatureState({ source: "munis", id: hoverId }, { hover: false });
      hoverId = f.id;
      map.setFeatureState({ source: "munis", id: hoverId }, { hover: true });
      map.getCanvas().style.cursor = "pointer";
      const p = f.properties;
      tip.innerHTML = `<b>${p.pref} ${p.name}</b><br>${describe(p)}${p.nonsel ? "<br>指数表の選定外（※）" : ""}`;
      tip.hidden = false;
      const x = e.originalEvent.clientX, y = e.originalEvent.clientY;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = `${Math.min(x + 14, innerWidth - w - 8)}px`;
      tip.style.top = `${Math.min(y + 14, innerHeight - h - 8)}px`;
    });
    map.on("mouseleave", "muni-fill", () => {
      if (hoverId !== null) map.setFeatureState({ source: "munis", id: hoverId }, { hover: false });
      hoverId = null;
      tip.hidden = true;
      map.getCanvas().style.cursor = "";
    });
    map.on("click", "muni-fill", (e) => {
      const p = e.features[0].properties;
      map.setFilter("muni-picked", ["==", ["get", "code"], p.code || ""]);
      showDetail(p);
    });
  });

  renderLegend();
  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.getElementById("clear").addEventListener("click", () => select(null));

  const dl = document.getElementById("names");
  const byLabel = new Map();
  for (const f of features) {
    const p = f.properties;
    if (!p.code) continue;
    const label = `${p.name}（${p.pref}）`;
    byLabel.set(label, p.code);
  }
  dl.innerHTML = [...byLabel.keys()].map((l) => `<option value="${l}">`).join("");
  const q = document.getElementById("q");
  q.addEventListener("change", () => {
    const v = q.value.trim();
    let code = byLabel.get(v);
    if (!code) {
      const hits = features.filter((f) => f.properties.code && f.properties.name === v);
      if (hits.length === 1) code = hits[0].properties.code;
    }
    if (code) focusCode(code);
  });
}

init();
