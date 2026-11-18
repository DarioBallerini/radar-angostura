// Casas en alquiler permanente (anual) en Villa La Angostura.
// - relevar(page, fecha): baja los avisos de cada fuente a data/alquileres/<fuente>-<fecha>.json
// - normalizar(fecha): arma data/alquiler-<fecha>.json y lo suma al índice data/alquileres.json
// Uso suelto: node alquileres.mjs --build 2026-11-18   (rearma el relevamiento desde los archivos ya bajados)
//
// Criterio de moneda: todo se lleva a pesos por mes. Los avisos publicados en dólares se pasan a pesos
// con el dólar oficial (venta) del día del relevamiento y se guarda el monto original en la columna "usd".
// Los alquileres temporarios o turísticos (por noche o por semana) quedan afuera.
import fs from "node:fs";
import path from "node:path";
import { barrioTexto, barrioGeo, enVLA } from "./locales.mjs";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(DIR, "../data");
const RAW = path.join(DATA, "alquileres");
const sleep = ms => new Promise(r => setTimeout(r, ms + Math.random() * 1200));

export const SOURCES = {
  a: ["Argenprop", "https://www.argenprop.com/casa-en-alquiler-en-{slug}--{id}"],
  z: ["Zonaprop", "https://www.zonaprop.com.ar/propiedades/clasificado/{slug}-{id}.html"],
  pa: ["Patagónica", "https://patagonicapropiedades.com.ar/propiedad/{slug}--{id}"],
  cb: ["Coldwell Banker", "https://cbpatagonialakes.com.ar/propiedad/{slug}--{id}"],
  am: ["Ariel Martin", "https://ampropiedades.com.ar/propiedades/{slug}/"],
};

/* ---------- Extractores ---------- */

async function argenprop(page) {
  const base = "https://www.argenprop.com/casas/alquiler/villa-la-angostura";
  const out = new Map();
  for (let n = 1; n <= 10; n++) {
    await page.goto(n === 1 ? base : `${base}?pagina-${n}`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    const items = await page.$$eval("a.card[idaviso]", cs => cs.map(c => {
      const t = s => c.querySelector(s)?.innerText.trim().replace(/\s+/g, " ") || "";
      return [c.getAttribute("idaviso"), c.getAttribute("idmoneda"), Number(c.getAttribute("montooperacion")), c.getAttribute("dormitorios"),
        t(".card__address"), [...c.querySelectorAll(".card__main-features li")].map(l => l.innerText).join("|"), t(".card__title") + " " + t(".card__info"), c.getAttribute("href")];
    }));
    const before = out.size;
    for (const it of items) out.set(it[0], it);
    if (!items.length || out.size === before) break;
  }
  return [...out.values()];
}

async function zonaprop(page) {
  const out = new Map();
  for (let n = 1; n <= 9; n++) {
    await page.goto(`https://www.zonaprop.com.ar/casas-alquiler-villa-la-angostura${n > 1 ? "-pagina-" + n : ""}.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-qa="posting PROPERTY"]', { timeout: 30000 }).catch(() => {});
    await sleep(3500);
    const items = await page.$$eval('[data-qa="posting PROPERTY"]', cs => cs.map(c => {
      const q = s => c.querySelector(`[data-qa="${s}"]`)?.innerText.trim().replace(/\s+/g, " ") || "";
      return [c.dataset.id, q("POSTING_CARD_PRICE"), q("POSTING_CARD_LOCATION"),
        [...(c.querySelector('[data-qa="POSTING_CARD_FEATURES"]')?.children || [])].map(e => e.innerText).join("|"),
        q("POSTING_CARD_DESCRIPTION").slice(0, 300), (c.dataset.toPosting || "").split("?")[0]];
    }));
    const before = out.size;
    for (const it of items) out.set(it[0], it);
    if (!items.length || out.size === before) break;
  }
  return [...out.values()];
}

// Patagónica y Coldwell Banker: mismo proveedor de sitios. El listado mezcla operaciones, se filtra por texto o moneda.
async function plantillaAlquiler() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const field = (t, l) => { const m = t.match(new RegExp(l + ":\\s*\\n?\\s*([\\d.,]+)")); return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : null; };
  const out = [], seen = new Set();
  for (let p = 1; p <= 25; p++) {
    const d = new DOMParser().parseFromString(await (await fetch(location.pathname + "?page=" + p)).text(), "text/html");
    let nuevas = 0;
    for (const c of [...d.querySelectorAll(".details")].filter(c => c.querySelector("h5 a"))) {
      const href = c.querySelector("h5 a").getAttribute("href"), id = href.match(/--(\d+)/)?.[1];
      if (!id || seen.has(id)) continue; seen.add(id); nuevas++;
      const txt = c.innerText, pr = c.querySelector("[data-price]");
      if (!/alquil|renta/i.test(txt + href) && pr?.dataset.currency !== "2") continue;
      const r = [id, pr ? +pr.dataset.price : null, pr?.dataset.currency || "", null, null, null, null, null, href.replace("/propiedad/", "").replace(/--\d+$/, ""), txt.replace(/\s+/g, " ").trim().slice(0, 200)];
      try {
        const hh = await (await fetch(href)).text();
        const g = hh.match(/"geo":\{"@type":"GeoCoordinates","latitude":(-?[\d.]+),"longitude":(-?[\d.]+)/);
        if (g) { r[6] = +g[1]; r[7] = +g[2]; }
        const dd = new DOMParser().parseFromString(hh, "text/html"); dd.querySelectorAll("script,style").forEach(s => s.remove());
        const t = dd.body.textContent.replace(/\s*\n\s*/g, "\n");
        r[3] = field(t, "Dormitorios"); r[4] = field(t, "Sup. Cubierta"); r[5] = field(t, "Sup. del Terreno");
      } catch (e) {}
      out.push(r); await sleep(500);
    }
    if (!nuevas) break; await sleep(700);
  }
  return out;
}

// Ariel Martin: los alquileres aparecen en la categoría casas con "alquiler" en el título.
async function amAlquiler() {
  const out = [];
  for (let p = 1; p <= 20; p++) {
    const r0 = await fetch("/e/casas/" + (p > 1 ? "page/" + p + "/" : "")); if (!r0.ok) break;
    const d = new DOMParser().parseFromString(await r0.text(), "text/html");
    const us = [...new Set([...d.querySelectorAll('a[href*="/propiedades/"]')].map(a => a.href))].filter(u => /alquil/i.test(u));
    for (const u of us) {
      if (out.some(r => r[0] === u)) continue;
      const dd = new DOMParser().parseFromString(await (await fetch(u)).text(), "text/html"); dd.querySelectorAll("script,style").forEach(s => s.remove());
      out.push([u.replace(/^.*\/propiedades\//, "").replace(/\/$/, ""), dd.body.textContent.replace(/\s+/g, " ").trim().slice(0, 1500)]);
    }
    if (!d.querySelector('a[href*="/page/' + (p + 1) + '/"]')) break;
  }
  return out;
}

const SITIOS = [
  ["patagonica", "https://patagonicapropiedades.com.ar/propiedades/casas/alquiler/Argentina-Neuquen-Villa+La+Angostura", plantillaAlquiler],
  ["coldwell", "https://cbpatagonialakes.com.ar/propiedades/casas/alquiler/Argentina-Neuquen-Villa+La+Angostura", plantillaAlquiler],
  ["ampropiedades", "https://ampropiedades.com.ar/e/casas/", amAlquiler],
];

// Dólar oficial (venta) del día, para pasar a pesos los avisos en dólares.
export async function dolar(page) {
  try {
    await page.goto("https://dolarapi.com/v1/dolares/oficial", { waitUntil: "domcontentloaded" });
    const j = JSON.parse(await page.evaluate(() => document.body.innerText));
    return { oficial: j.venta, fuente: "dolarapi.com (oficial, venta)", fecha: j.fechaActualizacion };
  } catch (e) { return null; }
}

export async function relevar(page, fecha) {
  fs.mkdirSync(RAW, { recursive: true });
  const save = (f, rows) => { fs.writeFileSync(path.join(RAW, `${f}-${fecha}.json`), JSON.stringify(rows)); console.log(`Alquileres ${f}: ${rows.length} avisos`); };
  for (const [f, fn] of [["argenprop", argenprop], ["zonaprop", zonaprop]]) {
    try { save(f, await fn(page)); } catch (e) { console.error(`Alquileres ${f} falló:`, e.message); }
  }
  for (const [f, url, fn] of SITIOS) {
    try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); await sleep(2000); save(f, await page.evaluate(fn)); }
    catch (e) { console.error(`Alquileres ${f} falló:`, e.message); }
  }
  const tc = await dolar(page);
  if (tc) fs.writeFileSync(path.join(RAW, `dolar-${fecha}.json`), JSON.stringify(tc));
}

/* ---------- Normalización ---------- */

const TEMPORARIO = /tur[ií]stic|temporari|temporal|por noche|por d[ií]a|\d+\s*pax|hasta \d+ personas|para \d+ personas|•\s*\d+ personas|alquiler familiar|caba[ñn]as en|complejo/i;
const num = s => { if (s == null) return null; if (typeof s === "number") return s; const d = String(s).replace(/[^\d]/g, ""); return d ? Number(d) : null; };
const feat = (f, re) => num((f.match(re) || [])[1]);
// Pesos por mes con rango razonable para una casa (descarta precios por noche y errores de carga).
const MIN_ARS = 300000, MAX_ARS = 15000000;

export function normalizar(fecha) {
  const tcFile = path.join(RAW, `dolar-${fecha}.json`);
  const tc = fs.existsSync(tcFile) ? JSON.parse(fs.readFileSync(tcFile, "utf8")) : null;
  if (!tc?.oficial) throw new Error("Falta la cotización del dólar del " + fecha);
  const rd = f => { const p = path.join(RAW, `${f}-${fecha}.json`); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : []; };
  const filas = [], descartes = [];
  const push = (src, id, monto, moneda, barrio, cub, tot, dorm, slug, texto, lat = null, lon = null) => {
    id = String(id);
    if (TEMPORARIO.test(`${slug || ""} ${texto || ""}`)) return descartes.push([src, id, "temporario"]);
    if (!enVLA(lat, lon)) return descartes.push([src, id, "fuera de VLA"]);
    if (!monto) return descartes.push([src, id, "sin precio"]);
    let usd = null, price = monto;
    // un aviso "en dólares" de más de 100.000 por mes es un precio en pesos mal cargado
    if (moneda === "USD" && monto < 100000) { if (monto < 500) return descartes.push([src, id, "precio por noche"]); usd = monto; price = Math.round(monto * tc.oficial); }
    if (price < MIN_ARS || price > MAX_ARS) return descartes.push([src, id, "precio fuera de rango"]);
    cub = num(cub); tot = num(tot);
    if (cub && (cub < 20 || cub > 1500)) cub = null;
    if (tot && (tot < 50 || tot > 300000)) tot = null;
    filas.push([src, id, price, barrio || "Sin barrio", cub, tot, dorm ? Math.round(dorm) : null, slug, usd]);
  };
  for (const [id, mon, monto, dorm, addr, f, desc, href] of rd("argenprop")) {
    const cub = feat(f, /(\d+)\s*m² cub/), tot = feat(f, /(\d+)\s*m² tot/);
    const slug = href.replace(/^\//, "").replace("casa-en-alquiler-en-", "").replace(/--\d+$/, "");
    push("a", id, monto, mon === "2" ? "USD" : "ARS", barrioTexto(addr.split(",")[0], desc), cub, tot, num(dorm), slug, desc);
  }
  for (const [id, ptxt, loc, f, desc, href] of rd("zonaprop")) {
    const m = ptxt.match(/(USD|\$)\s*([\d.]+)/);
    const slug = href.replace(/^.*\/clasificado\//, "").replace(/-\d+\.html$/, "");
    const cub = feat(f, /(\d+)\s*m² cub/) || num((desc.match(/(\d{2,3})\s*m(?:2|²|ts)/i) || [])[1]);
    push("z", id, m ? num(m[2]) : null, m?.[1] === "USD" ? "USD" : "ARS", barrioTexto(loc.split(",")[0], desc, slug), cub, feat(f, /(\d+)\s*m² tot/), feat(f, /(\d+)\s*dorm/), slug, `${slug} ${desc}`);
  }
  for (const [f, code] of [["patagonica", "pa"], ["coldwell", "cb"]]) for (const [id, monto, cur, dorm, cub, tot, lat, lon, slug, texto] of rd(f)) {
    push(code, id, monto, cur === "1" ? "USD" : "ARS", barrioTexto(texto, slug) || barrioGeo(lat, lon), cub, tot, dorm, slug, texto, lat, lon);
  }
  for (const [slug, texto] of rd("ampropiedades")) {
    const m = texto.match(/Valor locativo:\s*\$\s*([\d.]+)/) || texto.match(/Valor\s*:\s*(?:U\$S\s*)?\$\s*([\d.]+)/);
    push("am", slug, m ? num(m[1]) : null, "ARS", barrioTexto(texto, slug), (texto.match(/Cubiertos:\s*([\d.]+)/) || [])[1], (texto.match(/de lote:\s*([\d.]+)/) || [])[1],
      num((texto.match(/Habitaciones:\s*(\d+)/) || [])[1]), slug, texto);
  }
  const out = { date: fecha, op: "alquiler", moneda: "ARS", tc, fields: ["src", "id", "price", "barrio", "m2cub", "m2tot", "dorm", "slug", "usd"], rows: filas, sources: SOURCES };
  const file = path.join(DATA, `alquiler-${fecha}.json`);
  fs.writeFileSync(file, JSON.stringify(out));
  const idxFile = path.join(DATA, "alquileres.json");
  const idx = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, "utf8")) : { files: [] };
  if (!idx.files.includes(path.basename(file))) { idx.files.push(path.basename(file)); idx.files.sort(); }
  fs.writeFileSync(idxFile, JSON.stringify(idx));
  return { filas, descartes, file };
}

if (process.argv[1] === new URL(import.meta.url).pathname && process.argv[2] === "--build") {
  const { filas, descartes, file } = normalizar(process.argv[3]);
  console.log(`Alquileres: ${filas.length} casas → ${file}`);
  for (const f of filas) console.log("  ", f.join(" | "));
  console.log("Descartados:", descartes.map(d => d.join(" ")).join("; "));
}
