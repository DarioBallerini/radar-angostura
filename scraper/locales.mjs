// Inmobiliarias locales de Villa La Angostura con avisos en su propia web.
// - relevar(page, fecha): recorre cada sitio con el navegador y guarda data/locales/<fuente>-<fecha>.json
// - normalizar(fecha): convierte esos archivos a filas del relevamiento [src,id,price,barrio,m2cub,m2tot,dorm,slug]
// Uso suelto: node locales.mjs --build 2026-11-18   (rearma las filas desde los archivos ya bajados)
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(DIR, "../data");
const LOC = path.join(DATA, "locales");
const sleep = ms => new Promise(r => setTimeout(r, ms + Math.random() * 800));

export const SOURCES = {
  patagonica:    ["pa", "Patagónica", "https://patagonicapropiedades.com.ar/propiedad/{slug}--{id}"],
  coldwell:      ["cb", "Coldwell Banker", "https://cbpatagonialakes.com.ar/propiedad/{slug}--{id}"],
  camposhaedo:   ["ch", "Campos Haedo", "https://jchpropiedades.com/propiedades/{slug}/"],
  fanelli:       ["fa", "Fanelli", "https://fanellipropiedades.ar/propiedad/{slug}/"],
  vilaterra:     ["vi", "Vilaterra", "https://vilaterra.com.ar/properties/{slug}/"],
  rimos:         ["ri", "Rimos", "https://www.rimospropiedades.com/propiedad/{id}"],
  ampropiedades: ["am", "Ariel Martin", "https://ampropiedades.com.ar/propiedades/{slug}/"],
};

/* ---------- Extractores: corren dentro de la página de cada sitio ---------- */

// Plantilla compartida por Patagónica y Coldwell Banker (mismo proveedor de sitios).
async function plantillaListado() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const field = (t, l) => { const m = t.match(new RegExp(l + ":\\s*\\n?\\s*([\\d.,]+)")); return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : null; };
  const out = [];
  for (let p = 1; p <= 25; p++) {
    const d = new DOMParser().parseFromString(await (await fetch(location.pathname + "?page=" + p)).text(), "text/html");
    const cards = [...d.querySelectorAll(".details")].filter(c => c.querySelector("h5 a"));
    let nuevas = 0;
    for (const c of cards) {
      const href = c.querySelector("h5 a").getAttribute("href"), id = href.match(/--(\d+)/)?.[1];
      if (!id || out.some(r => r[0] === id)) continue; nuevas++;
      const pr = c.querySelector("[data-price]"); // el precio de la tarjeta es el confiable
      const r = [id, pr ? +pr.dataset.price : null, pr?.dataset.currency, null, null, null, null, null, href.replace("/propiedad/", "").replace(/--\d+$/, "")];
      try {
        const hh = await (await fetch(href)).text();
        const g = hh.match(/"geo":\{"@type":"GeoCoordinates","latitude":(-?[\d.]+),"longitude":(-?[\d.]+)/);
        if (g) { r[6] = +g[1]; r[7] = +g[2]; }
        const dd = new DOMParser().parseFromString(hh, "text/html"); dd.querySelectorAll("script,style").forEach(s => s.remove());
        const t = dd.body.textContent.replace(/\s*\n\s*/g, "\n");
        r[3] = field(t, "Dormitorios"); r[4] = field(t, "Sup. Cubierta"); r[5] = field(t, "Sup. del Terreno");
      } catch (e) {}
      out.push(r); await sleep(600);
    }
    if (!nuevas) break; await sleep(900);
  }
  return out;
}

async function camposHaedo() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const num = (t, l) => { const x = t.match(new RegExp(l + "\\n([\\d.,]+)")); return x ? parseFloat(x[1].replace(/\./g, "").replace(",", ".")) : null; };
  const out = [];
  for (let p = 1; p <= 8; p++) {
    const r0 = await fetch("/propiedades/" + (p > 1 ? "page/" + p + "/" : "") + "?filter_tipo%5B0%5D=casa"); if (!r0.ok) break;
    const cs = [...new DOMParser().parseFromString(await r0.text(), "text/html").querySelectorAll("article.propiedad-card")]; if (!cs.length) break;
    for (const c of cs) {
      const r = [c.id.replace("post-", ""), c.dataset.price, c.className.match(/operacion-(\w+)/)?.[1], null, null, null, null, null, c.dataset.url.replace(/^.*\/propiedades\//, "").replace(/\/$/, ""), c.dataset.title];
      try {
        const h = await (await fetch(c.dataset.url)).text();
        const g = h.match(/q=(-40\.\d+),(-71\.\d+)/); if (g) { r[6] = +g[1]; r[7] = +g[2]; }
        const dd = new DOMParser().parseFromString(h, "text/html"); dd.querySelectorAll("script,style").forEach(s => s.remove());
        const t = dd.body.textContent.replace(/\s*\n\s*/g, "\n");
        r[3] = num(t, "Dormitorios"); r[4] = num(t, "Superficie construida") || num(t, "Superficie cubierta"); r[5] = num(t, "Superficie del terreno");
      } catch (e) {}
      out.push(r); await sleep(600);
    }
    await sleep(800);
  }
  return out;
}

async function fanelli() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const j = await (await fetch("/wp-json/wp/v2/propiedad?per_page=100&_fields=id,link,title,class_list")).json();
  const out = [];
  for (const p of j.filter(p => p.class_list.includes("property-type-casas") && p.class_list.includes("property-status-venta"))) {
    const r = [String(p.id), null, null, null, null, null, null, null, p.link.replace(/^.*\/propiedad\//, "").replace(/\/$/, ""), null, p.class_list.filter(x => x.startsWith("property-city-")).join(",")];
    try {
      const h = await (await fetch(p.link)).text();
      const g = h.match(/(-40\.\d{4,})["',\s]+(-71\.\d{4,})/); if (g) { r[6] = +g[1]; r[7] = +g[2]; }
      const dd = new DOMParser().parseFromString(h, "text/html"); dd.querySelectorAll("script,style").forEach(s => s.remove());
      const t = dd.body.textContent.replace(/\s*\n\s*/g, "\n");
      const m = t.match(/\n(Venta|Alquiler)\n(USD|\$|U\$S)\s*([\d.,]+)/); if (m) { r[2] = m[2]; r[1] = +m[3].replace(/[.,]/g, ""); }
      const n = l => { const x = t.match(new RegExp("\\n" + l + "\\n([\\d.,]+)")); return x ? +x[1].replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".") : null; };
      r[3] = n("Habitaciones"); r[4] = n("Área"); r[5] = n("Tamaño del Lote"); r[9] = (t.match(/\nUbicación:\n([^\n]+)/) || [])[1] || null;
    } catch (e) {}
    out.push(r); await sleep(600);
  }
  return out;
}

async function vilaterra() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const L = new Set();
  for (let p = 1; p <= 10; p++) {
    const r0 = await fetch("/lista-de-propiedades/" + (p > 1 ? "page/" + p + "/" : "")); if (!r0.ok) break;
    const n0 = L.size; for (const m of (await r0.text()).matchAll(/https:\/\/vilaterra\.com\.ar\/properties\/[^\/"]+\//g)) L.add(m[0]);
    if (L.size === n0) break; await sleep(700);
  }
  const out = [];
  for (const u of L) {
    try {
      const d = new DOMParser().parseFromString(await (await fetch(u)).text(), "text/html"); d.querySelectorAll("script,style").forEach(s => s.remove());
      const t = d.body.textContent.replace(/\s*\n\s*/g, "\n");
      const pm = t.match(/\n\$([\d,]+)\s+(Venta|Alquiler)\n([^\n]+)\n/);
      if (!pm || pm[2] !== "Venta" || !/Casa/i.test(pm[3])) { await sleep(400); continue; }
      const cub = t.match(/([\d.,]+)\s*m(?:2|²|ts2)?\s*(?:cubiertos|cub)/i);
      out.push([(t.match(/Propiedad ID:\s*(\d+)/) || [])[1], +pm[1].replace(/,/g, ""), +((t.match(/(\d+)\s*Bedrooms?/) || [])[1] || 0) || null,
        cub ? +cub[1].replace(/[.,]/g, "") : null, +((t.match(/\n([\d.,]+)\s*mts2/) || [])[1] || "").replace(/[.,]/g, "") || null,
        null, null, u.replace(/^.*\/properties\//, "").replace(/\/$/, ""), (t.match(/Propiedad ID:\s*\d+\n([^\n]+)/) || [])[1] || ""]);
    } catch (e) {}
    await sleep(600);
  }
  return out;
}

async function rimos() {
  await new Promise(r => setTimeout(r, 2500)); // la lista se arma con JavaScript
  const seen = new Set(), rows = [];
  for (const a of document.querySelectorAll('a[href*="/propiedad/"]')) {
    const id = a.href.match(/propiedad\/(\d+)/)?.[1]; if (!id || seen.has(id)) continue;
    let c = a; for (let i = 0; i < 5 && c && !/USD|Consultar/.test(c.innerText); i++) c = c.parentElement;
    seen.add(id); rows.push([id, (c ? c.innerText : a.innerText).split("\n").map(s => s.trim()).filter(Boolean).join(" | ")]);
  }
  return rows.filter(r => /\| (CASA|CABAÑA|DUPLEX|PH) \|/.test(r[1]));
}

async function amPropiedades() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const out = [];
  for (let p = 1; p <= 20; p++) {
    const r0 = await fetch("/e/casas/" + (p > 1 ? "page/" + p + "/" : "")); if (!r0.ok) break;
    const d = new DOMParser().parseFromString(await r0.text(), "text/html");
    const us = [...new Set([...d.querySelectorAll('a[href*="/propiedades/"]')].map(a => a.href))].filter(u => !/\/propiedades\/$/.test(u));
    let nuevas = 0;
    for (const u of us) {
      if (out.some(r => r[0] === u)) continue; nuevas++;
      let c = d.querySelector(`a[href="${u}"]`); for (let i = 0; i < 6 && c && !/Valor/.test(c.textContent); i++) c = c.parentElement;
      out.push([u, (c ? c.textContent : "").replace(/\s+/g, " ").trim().slice(0, 300)]);
    }
    if (!nuevas) break; await sleep(800);
  }
  return out.map(([u, t]) => [u.replace(/^.*\/propiedades\//, "").replace(/\/$/, ""), t.replace(/^CASAS\s*/, "").replace(/Solo a través de Ariel Martin Propiedades/g, "")]);
}

const SITIOS = [
  ["patagonica", "https://patagonicapropiedades.com.ar/propiedades/casas/venta/Argentina-Neuquen-Villa+La+Angostura", plantillaListado],
  ["coldwell", "https://cbpatagonialakes.com.ar/propiedades/casas/venta/Argentina-Neuquen-Villa+La+Angostura", plantillaListado],
  ["camposhaedo", "https://jchpropiedades.com/propiedades/?filter_tipo%5B0%5D=casa", camposHaedo],
  ["fanelli", "https://fanellipropiedades.ar/", fanelli],
  ["vilaterra", "https://vilaterra.com.ar/lista-de-propiedades/", vilaterra],
  ["rimos", "https://www.rimospropiedades.com/ventas", rimos],
  ["ampropiedades", "https://ampropiedades.com.ar/e/casas/", amPropiedades],
];

export async function relevar(pagina, fecha) {
  const pg = typeof pagina === "function" ? pagina : async () => pagina;
  fs.mkdirSync(LOC, { recursive: true });
  for (const [fuente, url, fn] of SITIOS) {
    try {
      const page = await pg();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(2000);
      const rows = await page.evaluate(fn);
      fs.writeFileSync(path.join(LOC, `${fuente}-${fecha}.json`), JSON.stringify(rows));
      console.log(`${SOURCES[fuente][1]}: ${rows.length} avisos`);
    } catch (e) { console.error(`${SOURCES[fuente][1]} falló:`, e.message); }
    await sleep(1500);
  }
}

/* ---------- Normalización: barrio por texto y, si no, por ubicación en el mapa ---------- */

const plain = s => " " + (s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
const ALIAS = {
  "lomas del correntoso": "Lomas del Correntoso", "lomas de correntoso": "Lomas del Correntoso", "las lomas": "Lomas del Correntoso", "eco lomas": "Lomas del Correntoso",
  "villa correntoso": "Villa Correntoso", "v correntoso": "Villa Correntoso",
  "barrio norte": "Barrio Norte", "b norte": "Barrio Norte", "bario norte": "Barrio Norte", "barro norte": "Barrio Norte", "la angostura norte": "Barrio Norte",
  "el once": "El Once", "barrio once": "El Once", "b once": "El Once", "bel once": "El Once",
  "tres cerros": "Tres Cerros", "3 cerros": "Tres Cerros", "akol": "Tres Cerros",
  "peumayen": "Peumayén", "epulafquen": "Epulafquen", "epulaufquen": "Epulafquen",
  "las balsas": "Las Balsas", "barrio balsas": "Las Balsas", "b balsas": "Las Balsas", "ruca hue": "Las Balsas", "alfa centauro": "Las Balsas",
  "las piedritas": "Las Piedritas", "los volcanes": "Los Volcanes", "volcanes": "Los Volcanes",
  "el cruce": "El Cruce", "las margaritas": "Las Margaritas", "b margaritas": "Las Margaritas",
  "el mallin": "El Mallín", "barrio mallin": "El Mallín",
  "puerto manzano": "Puerto Manzano", "altos de manzano": "Puerto Manzano", "alto manzano": "Puerto Manzano", "altos del manzano": "Puerto Manzano",
  "manzano chico": "Puerto Manzano", "peninsula manzano": "Puerto Manzano", "peninsula de manzano": "Puerto Manzano", "bahia manzano": "Puerto Manzano",
  "rio bonito": "Puerto Manzano", "en manzano": "Puerto Manzano", "faldeo manzano": "Puerto Manzano",
  "cumelen": "Cumelén", "faldeo del bayo": "Faldeo del Bayo", "faldeo bayo": "Faldeo del Bayo", "el faldeo": "Faldeo del Bayo", "terrazas del bayo": "Faldeo del Bayo",
  "del cipres": "Del Ciprés", "paseo del cipres": "Del Ciprés", "maikana": "Maikana", "loma guacha": "Loma Guacha", "antilhue": "Antilhue",
  "muelle de piedra": "Muelle de Piedra", "bandurrias": "Bandurrias", "arauco": "Arauco",
  "barrio puerto": "La Villa (Puerto)", "puertovilla": "La Villa (Puerto)", "puerto villa": "La Villa (Puerto)", "la villa": "La Villa (Puerto)",
  "centro": "Centro", "centrico": "Centro", "el mercado": "Centro",
};
const AKEYS = Object.keys(ALIAS).sort((a, b) => b.length - a.length);
export const barrioTexto = (...t) => { const s = plain(t.filter(Boolean).join(" ")); const a = AKEYS.find(a => s.includes(" " + a + " ")); return a ? ALIAS[a] : null; };

function enAnillo([x, y], ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const enPoligono = (pt, poly) => enAnillo(pt, poly[0]) && !poly.slice(1).some(h => enAnillo(pt, h));
function distSeg([px, py], [ax, ay], [bx, by]) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
let AREAS = null;
export function barrioGeo(lat, lon) {
  if (lat == null || lon == null) return null;
  if ((lat === -40.7628 && lon === -71.6468) || (lat === -40.7616474 && lon === -71.6447641)) return null; // ubicación genérica del sitio
  AREAS ??= JSON.parse(fs.readFileSync(path.join(DATA, "vla-map.json"), "utf8")).areas;
  const pt = [lon, lat];
  const a = AREAS.find(a => a.p.some(poly => enPoligono(pt, poly))); if (a) return a.n;
  let best = null, bd = Infinity;
  for (const a of AREAS) for (const poly of a.p) { const r = poly[0]; for (let i = 1; i < r.length; i++) { const d = distSeg(pt, r[i - 1], r[i]); if (d < bd) { bd = d; best = a.n; } } }
  return bd < 0.004 ? best : null; // ~300 m
}
export const enVLA = (lat, lon) => lat == null || (lat > -40.83 && lat < -40.70 && lon > -71.75 && lon < -71.55);
const NO_CASA = /alquiler|departamento-local|departamentos-locales|cs-614-departamento|lote-de-109|san-luis|san-martin|meliquina|bariloche|chubut|llanquin|lago-hermoso/i;
const n = s => { if (s == null) return null; if (typeof s === "number") return s; const d = String(s).replace(/[^\d]/g, ""); return d ? Number(d) : null; };

export function normalizar(fecha) {
  const filas = [], descartes = [];
  for (const [fuente, [code]] of Object.entries(SOURCES)) {
    const f = path.join(LOC, `${fuente}-${fecha}.json`); if (!fs.existsSync(f)) continue;
    for (const r of JSON.parse(fs.readFileSync(f, "utf8"))) {
      let id, price, dorm = null, cub = null, tot = null, lat = null, lon = null, slug = null, titulo = "", extra = "";
      if (fuente === "patagonica" || fuente === "coldwell") {
        let cur; [id, price, cur, dorm, cub, tot, lat, lon, slug] = r; titulo = slug;
        if (cur !== "1") { descartes.push([fuente, id, "moneda"]); continue; }
      } else if (fuente === "camposhaedo") {
        let ptxt, op; [id, ptxt, op, dorm, cub, tot, lat, lon, slug, titulo] = r;
        if (op !== "venta" || !/USD/.test(ptxt || "")) { descartes.push([fuente, id, "operación"]); continue; }
        price = n(ptxt);
      } else if (fuente === "fanelli") {
        let cur, city; [id, price, cur, dorm, cub, tot, lat, lon, slug, extra, city] = r; titulo = slug;
        if (city !== "property-city-villa-la-angostura") { descartes.push([fuente, id, "otra ciudad"]); continue; }
      } else if (fuente === "vilaterra") {
        [id, price, dorm, cub, tot, lat, lon, slug, extra] = r; titulo = slug;
        if (/OTRA LOCALIDAD|Llanquin|Río Negro/i.test(extra || "")) { descartes.push([fuente, id, "otra ciudad"]); continue; }
        lat = lon = null; // el sitio pone la misma ubicación a todos los avisos
      } else if (fuente === "rimos") {
        const txt = r[1], parts = txt.split("|").map(s => s.trim()); id = r[0];
        const i = parts.findIndex(x => x.includes("·")); extra = i >= 0 ? parts[i].split("·")[0].trim() : ""; titulo = parts[i + 1] || "";
        price = n((txt.match(/USD ([\d.]+)/) || [])[1]); dorm = n((txt.match(/(\d+) dorm/) || [])[1]);
        const m = txt.match(/([\d.]+) m²/); cub = m ? Math.round(parseFloat(m[1])) : null;
      } else if (fuente === "ampropiedades") {
        const txt = r[1]; id = slug = r[0]; titulo = txt;
        if (/A CONSULTAR/.test(txt)) { descartes.push([fuente, id, "sin precio"]); continue; }
        price = n((txt.match(/Valor : U\$S \$?([\d.]+)/) || [])[1]);
        const m = txt.match(/Cubiertos: ([\d.]+)/); cub = m ? Math.round(parseFloat(m[1])) : null;
        tot = n((txt.match(/de lote: ([\d.]+)/) || [])[1]);
      }
      id = String(id);
      if (NO_CASA.test(`${slug || ""} ${titulo || ""}`)) { descartes.push([fuente, id, "no es casa en venta en VLA"]); continue; }
      if (!enVLA(lat, lon)) { descartes.push([fuente, id, "fuera de VLA"]); continue; }
      if (!price || price < 20000) { descartes.push([fuente, id, "sin precio"]); continue; }
      cub = n(cub); tot = n(tot);
      if (cub && (cub < 20 || cub > 2000)) cub = null;
      if (tot && (tot < 50 || tot > 300000)) tot = null;
      if (cub && price / cub < 250) { descartes.push([fuente, id, "precio sospechoso"]); continue; }
      const barrio = barrioTexto(extra, titulo, slug) || barrioGeo(lat, lon) || "Sin barrio";
      filas.push([code, id, Math.round(price), barrio, cub, tot, dorm ? Math.round(dorm) : null, slug]);
    }
  }
  return { filas, descartes };
}

export const sourcesMeta = () => ({
  a: ["Argenprop", "https://www.argenprop.com/casa-en-venta-en-{slug}--{id}"],
  z: ["Zonaprop", "https://www.zonaprop.com.ar/propiedades/clasificado/veclcain-casa-{id}.html"],
  ...Object.fromEntries(Object.values(SOURCES).map(([c, nombre, url]) => [c, [nombre, url]])),
});

// node locales.mjs --build FECHA  → suma las filas locales al snapshot-FECHA.json existente
if (process.argv[1] === new URL(import.meta.url).pathname && process.argv[2] === "--build") {
  const fecha = process.argv[3];
  const file = path.join(DATA, `snapshot-${fecha}.json`);
  const snap = JSON.parse(fs.readFileSync(file, "utf8"));
  const { filas, descartes } = normalizar(fecha);
  snap.rows = snap.rows.filter(r => r[0] === "a" || r[0] === "z").concat(filas);
  snap.sources = sourcesMeta();
  fs.writeFileSync(file, JSON.stringify(snap));
  const cnt = {}; for (const r of filas) cnt[r[0]] = (cnt[r[0]] || 0) + 1;
  console.log(`Inmobiliarias: ${filas.length} casas`, cnt, `· descartadas ${descartes.length}`);
}
