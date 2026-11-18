// Relevamiento de todas las casas en venta y en alquiler en Villa La Angostura.
// Uso: npm install && npx playwright install chromium && npm run scrape
// Genera ../data/snapshot-AAAA-MM-DD.json (todas las casas, sin tope de precio) para cargar en Radar Angostura (pestaña Casas → "Cargar relevamiento").
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { relevar, normalizar, sourcesMeta } from "./locales.mjs";
import * as noticias from "./noticias.mjs";
import * as alquileres from "./alquileres.mjs";

// Se releva todo el mercado; el presupuesto se filtra en la app.
const OUT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../data");
const PROFILE = path.resolve(path.dirname(new URL(import.meta.url).pathname), ".perfil-navegador");

const ALIAS = {
  "villa la angostura": "", "puerto": "Puerto Manzano", "faldeo manzano": "Puerto Manzano",
  "lomas de correntoso": "Lomas del Correntoso", "epulaufquen": "Epulafquen", "peumayen": "Peumayén",
  "altos de cumelen": "Cumelén", "cumelen": "Cumelén", "el mallin": "El Mallín", "rincon del totoral": "Rincón del Totoral",
  "faldeo del bayo": "Faldeo del Bayo", "la villa": "La Villa (Puerto)", "barrio norte": "Barrio Norte",
};
// Si el portal no trae barrio, se busca en la descripción.
const KEYWORDS = [
  ["puerto manzano", "Puerto Manzano"], ["las balsas", "Las Balsas"], ["piedritas", "Las Piedritas"],
  ["barrio norte", "Barrio Norte"], ["peumay", "Peumayén"], ["tres cerros", "Tres Cerros"], ["3 cerros", "Tres Cerros"],
  ["epulaf", "Epulafquen"], ["epulauf", "Epulafquen"], ["lomas del correntoso", "Lomas del Correntoso"],
  ["villa correntoso", "Villa Correntoso"], ["correntoso", "Villa Correntoso"], ["cumel", "Cumelén"],
  ["faldeo del bayo", "Faldeo del Bayo"], ["el mallin", "El Mallín"], ["el once", "El Once"], ["barrio once", "El Once"],
  ["los volcanes", "Los Volcanes"], ["totoral", "Rincón del Totoral"], ["el cruce", "El Cruce"],
];
const plain = s => (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function barrioDe(raw, desc) {
  const k = plain(raw);
  let b = k in ALIAS ? ALIAS[k] : (raw || "").trim();
  if (b && !/neuquen/.test(plain(b))) return b;
  const d = plain(desc);
  for (const [kw, name] of KEYWORDS) if (d.includes(kw)) return name;
  return "Sin barrio";
}
const num = s => { const m = String(s || "").match(/(\d[\d.]*)/); return m ? Number(m[1].replace(/\./g, "")) : null; };
const sleep = ms => new Promise(r => setTimeout(r, ms + Math.random() * 1500));

async function argenprop(page) {
  const base = `https://www.argenprop.com/casas/venta/villa-la-angostura`;
  const out = new Map();
  for (let n = 1; n <= 20; n++) {
    await page.goto(n === 1 ? base : `${base}?pagina-${n}`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    const items = await page.$$eval("a.card[idaviso]", cs => cs.map(c => {
      const t = s => c.querySelector(s)?.innerText.trim().replace(/\s+/g, " ") || "";
      return { id: c.getAttribute("idaviso"), href: c.getAttribute("href"), moneda: c.getAttribute("idmoneda"), price: Number(c.getAttribute("montooperacion")),
        dorm: c.getAttribute("dormitorios"), address: t(".card__address"), feats: [...c.querySelectorAll(".card__main-features li")].map(l => l.innerText).join("|"),
        desc: t(".card__title") + " " + t(".card__info") };
    }));
    const before = out.size;
    for (const it of items) {
      if (it.moneda !== "2") continue;
      const slug = it.href.replace(/^\//, "").replace("casa-en-venta-en-", "").replace(/--\d+$/, "");
      out.set(it.id, ["a", it.id, it.price, barrioDe(it.address.split(",").pop(), it.desc),
        num((it.feats.match(/(\d+)\s*m² cub/) || [])[1]), num((it.feats.match(/(\d+)\s*m² tot/) || [])[1]),
        it.dorm ? Number(it.dorm) : null, slug]);
    }
    if (!items.length || out.size === before) break;
  }
  return [...out.values()];
}

async function zonaprop(page) {
  // Zonaprop bloquea a partir de la página 10 de un listado: se combinan tres listados (general, más de 400k y menos de 200k).
  const out = new Map();
  const listados = ["casas-venta-villa-la-angostura", "casas-venta-villa-la-angostura-mas-400000-dolar", "casas-venta-villa-la-angostura-menos-200000-dolar"];
  for (const l of listados) for (let n = 1; n <= 9; n++) {
    const url = `https://www.zonaprop.com.ar/${l}${n > 1 ? "-pagina-" + n : ""}.html`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-qa="posting PROPERTY"]', { timeout: 30000 }).catch(() => {});
    await sleep(3500);
    const items = await page.$$eval('[data-qa="posting PROPERTY"]', cs => cs.map(c => {
      const q = s => c.querySelector(`[data-qa="${s}"]`)?.innerText.trim().replace(/\s+/g, " ") || "";
      return { id: c.dataset.id, price: q("POSTING_CARD_PRICE"), loc: q("POSTING_CARD_LOCATION"),
        feats: [...(c.querySelector('[data-qa="POSTING_CARD_FEATURES"]')?.children || [])].map(e => e.innerText).join("|"),
        desc: q("POSTING_CARD_DESCRIPTION"), href: c.dataset.toPosting || "" };
    }));
    const before = out.size;
    for (const it of items) {
      const m = it.price.match(/USD\s*([\d.]+)/);
      if (!m) continue;
      const price = Number(m[1].replace(/\./g, ""));
      if (price < 20000) continue;
      if (/nordelta|tigre|zona-norte/i.test(it.href)) continue; // avisos mal ubicados
      const locParts = it.loc.split(",").map(s => s.trim());
      const raw = /angostura/i.test(locParts[0]) ? "" : locParts[0];
      let tot = num((it.feats.match(/(\d+)\s*m² tot/) || [])[1]); if (tot > 200000) tot = null;
      const cub = (it.feats.match(/(\d+)\s*m² cub/) || [])[1] || (it.desc.match(/(\d{2,3})(?:[.,]\d+)?\s*m(?:2|²|ts)\s*(?:cubiertos|construidos)/i) || [])[1];
      out.set(it.id, ["z", it.id, price, barrioDe(raw, it.desc), cub ? Number(cub) : null, tot,
        num((it.feats.match(/(\d+)\s*dorm/) || [])[1]), null]);
    }
    if (!items.length || out.size === before) break;
  }
  return [...out.values()];
}

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: { width: 1280, height: 900 }, locale: "es-AR" });
const page = ctx.pages()[0] || await ctx.newPage();
const rows = [];
for (const [name, fn] of [["Argenprop", argenprop], ["Zonaprop", zonaprop]]) {
  try { const r = await fn(page); console.log(`${name}: ${r.length} avisos`); rows.push(...r); }
  catch (e) { console.error(`${name} falló:`, e.message); }
}
const date = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
// Inmobiliarias locales: guarda data/locales/<fuente>-<fecha>.json y suma sus casas
try {
  await relevar(page, date);
  const { filas, descartes } = normalizar(date);
  console.log(`Inmobiliarias locales: ${filas.length} casas (descartadas ${descartes.length})`);
  rows.push(...filas);
} catch (e) { console.error("Inmobiliarias locales fallaron:", e.message); }
// Casas en alquiler permanente → data/alquiler-<fecha>.json (en pesos por mes)
try {
  await alquileres.relevar(page, date);
  const r = alquileres.normalizar(date);
  console.log(`Alquileres: ${r.filas.length} casas (descartados ${r.descartes.length}, temporarios incluidos)`);
} catch (e) { console.error("Alquileres fallaron:", e.message); }
// Noticias por barrio de los medios locales → data/noticias.json
try {
  await noticias.relevar(page, date);
  const r = noticias.normalizar(date);
  console.log(`Noticias: ${r.notas} con barrio, ${r.hechos} hechos delictivos distintos`);
} catch (e) { console.error("Noticias fallaron:", e.message); }
await ctx.close();
fs.mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(OUT_DIR, `snapshot-${date}.json`);
fs.writeFileSync(file, JSON.stringify({ date, fields: ["src", "id", "price", "barrio", "m2cub", "m2tot", "dorm", "slug"], rows, sources: sourcesMeta() }));
// índice de relevamientos publicados que lee la app
const idxFile = path.join(OUT_DIR, "snapshots.json");
const idx = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, "utf8")) : { files: [] };
if (!idx.files.includes(path.basename(file))) { idx.files.push(path.basename(file)); idx.files.sort(); }
fs.writeFileSync(idxFile, JSON.stringify(idx));
console.log(`Listo: ${rows.length} avisos → ${file}`);
