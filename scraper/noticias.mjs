// Noticias locales por barrio de Villa La Angostura.
// - relevar(page, fecha): lee los medios con el navegador y guarda data/noticias/<medio>-<fecha>.json (título, fecha, enlace y primeras líneas)
// - normalizar(fecha): asigna barrios, clasifica (positiva / negativa / hecho delictivo), agrupa notas del mismo hecho
//   y escribe data/noticias.json, que es lo que lee la app.
// Uso suelto: node noticias.mjs --build 2026-11-18   (rearma data/noticias.json desde los archivos ya bajados)
// La clasificación es por palabras clave sobre título y bajada: sirve para contar y ordenar, no es un análisis de cada nota.
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const DATA = path.resolve(DIR, "../data");
const NDIR = path.join(DATA, "noticias");
const MESES = 12;

export const MEDIOS = {
  da:  { n: "Diario Andino", url: "https://www.diarioandino.com.ar/" },
  lad: { n: "La Angostura Digital", url: "https://www.laangosturadigital.com.ar/" },
};

/* ---------- Barrios: alias estrictos para texto periodístico ---------- */
export const NALIAS = {
  "lomas del correntoso": "Lomas del Correntoso", "lomas de correntoso": "Lomas del Correntoso", "villa correntoso": "Villa Correntoso",
  "barrio norte": "Barrio Norte", "barrio el once": "El Once", "barrio once": "El Once", "tres cerros": "Tres Cerros", "3 cerros": "Tres Cerros",
  "peumayen": "Peumayén", "epulafquen": "Epulafquen", "epulaufquen": "Epulafquen", "las balsas": "Las Balsas", "las piedritas": "Las Piedritas",
  "los volcanes": "Los Volcanes", "barrio el cruce": "El Cruce", "barrio cruce": "El Cruce", "las margaritas": "Las Margaritas",
  "el mallin": "El Mallín", "barrio mallin": "El Mallín", "puerto manzano": "Puerto Manzano", "altos de manzano": "Puerto Manzano",
  "peninsula manzano": "Puerto Manzano", "rio bonito": "Puerto Manzano", "manzano chico": "Puerto Manzano", "cumelen": "Cumelén",
  "faldeo del bayo": "Faldeo del Bayo", "barrio belvedere": "Belvedere", "cuyen co": "Cuyén Có", "barrio siete lagos": "Siete Lagos",
  "barrio 7 lagos": "Siete Lagos", "macrolote": "Macrolotes", "cahuin hue": "Cahuín Hué", "bandurrias": "Bandurrias",
  "barrio la cabana": "La Cabaña", "76 viviendas": "76 Viviendas", "puertos de la villa": "Puertos de la Villa",
  "barrio la villa": "La Villa (Puerto)", "barrio el puerto": "La Villa (Puerto)", "bahia brava": "La Villa (Puerto)",
  "barrio arauco": "Arauco", "del cipres": "Del Ciprés", "maikana": "Maikana", "loma guacha": "Loma Guacha", "antilhue": "Antilhue",
  "muelle de piedra": "Muelle de Piedra", "microcentro": "Centro", "zona centrica": "Centro", "avenida arrayanes": "Centro",
  "av arrayanes": "Centro", "casco centrico": "Centro",
};
export const plain = s => " " + String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]+/g, " ") + " ";
export const barriosDe = t => { const s = plain(t); return [...new Set(Object.keys(NALIAS).filter(k => s.includes(" " + k + " ")).map(k => NALIAS[k]))]; };

/* ---------- Clasificación por palabras clave ---------- */
// cada término es prefijo de palabra; con "$" al final tiene que ser palabra completa
const rx = a => new RegExp("\\b(" + a.map(w => w.endsWith("$") ? w.slice(0, -1) + "\\b" : w).join("|") + ")", "gi");
const DELITO = rx(["robo$","robos$","robar","robaron","roban$","robada","robado","hurto","hurtaron","asalt","ladron","delincuen","malviviente","allanamiento","allanaron","allamiento","detenid","detuvieron","demorad","aprehendid","arrest","apunal","homicid","asesin","femicid","abuso sexual","abusador","violencia de genero","amenaz","usurpa","estafa","vandal","destrozos","apedre","piedrazos","incendio intencional","estupefaciente","narco","drogas$","marihuana","cocaina","arma de fuego","disparo","balazo","baleado","golpiza","agredi","agresion","intrus","sustraj","sustraido","acosad","acoso","imputad","condenad","prision","disturbios","rina$","forzar la puerta","ingresar a robar","acuchill","pelea$","batalla campal","patota"]);
const NEG = rx(["accidente","choque","chocaron","choco$","volco$","vuelco","despist","atropell","incendio","fuego$","herido","quemaduras","fallec","murio","muerte","corte de agua","corte de luz","sin agua","sin luz","sin presion","sin servicio","corte programado","falta de","reclam","quej","denunci","preocupa","malestar","basural","basura","residuos","humo$","contamina","cloaca","derrame","inunda","anega","desalojo","conflicto","problema","peligro","riesgo","deterior","baches","pozos$","ruidos","alerta","emergencia","rechaz","polemica","crisis","colaps","clausur","perdida","incumpl","multa","fuga de gas","rotura","sueltos","irregular","tragedia","repudio","bloquea","frena"]);
const POS = rx(["inaugur","reinaugur","pavimenta","pavimento","asfalt","veredas$","mejora","nueva plaza","nuevo centro","nueva escuela","centro de salud","ampliacion","ampliar$","finaliz","firmo el contrato","se firmo","adjudic","recupera","limpieza","saneamiento","festej","celebr","aniversario","premi","destacad","luminarias","iluminacion","red de gas","gas natural","electrificacion","agua potable","nuevas bombas","obras?$","viviendas$","loteo","sorteo","plaza$","juegos$","bicisenda","cesped","forestacion","solidari","donacion","renovo","renovara","eligieron","elecciones de la junta","junta vecinal","carteleria","atenuadores","nueva$","nuevo$","espectacular","avanza","comenzo","comienza"]);
const DEPORTE = rx(["torneo","partido","futbol","goles$","campeonato","liga$","fecha clave","semifinal","final$","basquet","voley","atletismo","tenis de mesa","visita","victoria","derrota","puntos$","cayo$","fixture","clausura$","apertura$","superclasico","cuartos de final","copa$","debut","vencio","empate","andres martin","rival","pincharratas","se mide","el depo","deportivo angostura","coihues","traspie","no pudo con","no pudo ante","buscara sostener","bandurrias resto"]);
const cuenta = (re, s) => (s.match(re) || []).length;

const MARCHA = /\b(march|movilizac|homenaje|aniversario|a \d+ anos)/;
// avisos de cortes de servicio que listan barrios: no son noticias del barrio
export const AVISO = /\b(cortes? (programad|del epen|de suministro|rotativos)|epen realizara|nuevos? cortes?)/;

export function clasificar({ title, lead }) {
  const t = plain(title), l = plain(String(lead || "").slice(0, 220));
  const del = !MARCHA.test(t) && (cuenta(DELITO, t) > 0 || (cuenta(DELITO, l) > 0 && !cuenta(POS, t)));
  const neg = 2 * cuenta(NEG, t) + cuenta(NEG, l), pos = 2 * cuenta(POS, t) + cuenta(POS, l);
  return { del, tono: del ? -1 : neg > pos ? -1 : pos > neg ? 1 : 0, deporte: cuenta(DEPORTE, t) > 0 };
}

// Notas de seguimiento del mismo hecho (mismo barrio, misma palabra clave de delito, ≤ 7 días desde la primera nota; ≤ 60 si es un apuñalamiento u homicidio) cuentan una sola vez.
const GRAVE = /^(apuna|homic|femic|asesi|abuso|balea|dispa)/;
function agruparHechos(rows) {
  const del = rows.filter(r => r.del).sort((a, b) => a.d.localeCompare(b.d));
  const raiz = r => (plain(r.t).match(DELITO) || []).map(w => { w = w.trim(); return /^(rob|hurt|sustra|ladr)/.test(w) ? "rob" : /^(apun|acuch)/.test(w) ? "apuna" : /^(pelea|rina|golp|agred|patot|batal)/.test(w) ? "pelea" : w.slice(0, 5); });
  let ev = 0; const ult = [];
  for (const r of del) {
    const k = raiz(r), t = Date.parse(r.d);
    const prev = ult.find(p => p.b.some(b => r.b.includes(b)) && p.k.some(w => k.includes(w) && t - p.t <= (GRAVE.test(w) ? 60 : 7) * 864e5));
    if (prev) r.ev = prev.ev; // sin encadenar: la ventana corre desde la primera nota del hecho
    else { r.ev = ++ev; ult.unshift({ ev, t, b: r.b, k }); }
  }
}

/* ---------- Extractores: corren dentro de la página de cada medio ---------- */
// Devuelven [{id, d, u, t, lead}] de los últimos `meses` meses, solo notas que nombran algún barrio.

async function diarioAndino({ claves, desde }) {
  const plain = s => " " + String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]+/g, " ") + " ";
  const dec = s => { let x = String(s || ""); for (let i = 0; i < 2; i++) { const ta = document.createElement("textarea"); ta.innerHTML = x; x = ta.value; } return x; };
  const parse = h => [...new DOMParser().parseFromString(h || "", "text/html").querySelectorAll("article")].map(a => { const l = a.querySelector('a[href*="/noticias/"]'); return l ? { u: l.getAttribute("href"), t: (a.querySelector("h2")?.textContent || l.getAttribute("aria-label") || "").trim() } : null; }).filter(Boolean);
  const fecha = u => u.split("/").slice(2, 5).join("-");
  const lista = new Map();
  // 1) Policiales completas del período (paginado del sitio)
  for (const x of parse(await (await fetch("/policiales/")).text())) lista.set(x.u, x);
  for (let q = 1; q < 20; q++) {
    const j = await (await fetch("/api/noticias/resultados?" + new URLSearchParams({ qpage: q, role: "categorias", qs: "policiales" }))).json();
    const xs = parse(j.html); if (!xs.length) break;
    for (const x of xs) lista.set(x.u, x);
    if (fecha(xs.at(-1).u) < desde) break;
  }
  // 2) Buscador del sitio, una búsqueda por nombre de barrio
  for (const k of claves) for (const x of parse(await (await fetch("/buscador/?s=" + encodeURIComponent(k))).text())) if (!lista.has(x.u)) lista.set(x.u, x);
  // 3) Cuerpo de cada nota
  const items = [...lista.values()].filter(x => fecha(x.u) >= desde), out = []; let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const x = items[i++];
      try {
        const d = new DOMParser().parseFromString(await (await fetch(x.u)).text(), "text/html");
        let ld = null;
        for (const s of d.querySelectorAll('script[type="application/ld+json"]')) { try { const j = JSON.parse(s.textContent); const a = [j].flat().concat(j["@graph"] || []).find(o => o && /Article/.test(o["@type"])); if (a) { ld = a; break; } } catch (e) {} }
        const t = dec(ld?.headline || d.querySelector("h1")?.textContent || x.t).trim();
        const lead = dec(ld?.articleBody || [...d.querySelectorAll("article p")].map(p => p.textContent).join(" ")).replace(/\s+/g, " ").trim().slice(0, 600);
        const s = plain(t + " " + lead);
        if (claves.some(k => s.includes(" " + k + " "))) out.push({ id: x.u.split("/").pop().split("-")[0], d: fecha(x.u), u: location.origin + x.u, t, lead });
      } catch (e) {}
    }
  };
  await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
  return out;
}

async function laAngosturaDigital({ claves, desde }) {
  const plain = s => " " + String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]+/g, " ") + " ";
  const txt = h => { const d = document.createElement("div"); d.innerHTML = String(h || "").replace(/<(script|style)[\s\S]*?<\/\1>/g, ""); return d.textContent.replace(/\s+/g, " ").trim(); };
  const fuera = new Set([5, 29, 4, 67, 30, 21, 17]); // regionales, paso, deportes, agenda, mascotas, cartas, gastronomía
  const out = [];
  for (let p = 1; p < 80; p++) {
    const r = await fetch(`/wp-json/wp/v2/posts?per_page=100&page=${p}&after=${desde}T00:00:00&_fields=id,date,link,title,content,categories`);
    if (!r.ok) break;
    const j = await r.json(); if (!j.length) break;
    for (const x of j) {
      if (x.categories.every(c => fuera.has(c))) continue;
      const t = txt(x.title.rendered), lead = txt(x.content.rendered).slice(0, 600), s = plain(t + " " + lead);
      if (claves.some(k => s.includes(" " + k + " "))) out.push({ id: String(x.id), d: x.date.slice(0, 10), u: x.link, t, lead });
    }
    if (j.length < 100) break;
  }
  return out;
}

const SITIOS = [["da", "https://www.diarioandino.com.ar/", diarioAndino], ["lad", "https://www.laangosturadigital.com.ar/", laAngosturaDigital]];

export async function relevar(pagina, fecha) {
  const pg = typeof pagina === "function" ? pagina : async () => pagina;
  fs.mkdirSync(NDIR, { recursive: true });
  const d = new Date(fecha); d.setMonth(d.getMonth() - MESES);
  const arg = { claves: Object.keys(NALIAS), desde: d.toISOString().slice(0, 10) };
  for (const [medio, url, fn] of SITIOS) {
    try {
      const page = await pg();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const rows = await page.evaluate(fn, arg);
      fs.writeFileSync(path.join(NDIR, `${medio}-${fecha}.json`), JSON.stringify(rows));
      console.log(`${MEDIOS[medio].n}: ${rows.length} notas con barrio`);
    } catch (e) { console.error(`${MEDIOS[medio].n} falló:`, e.message); }
  }
}

/* ---------- Normalización ---------- */
export function normalizar(fecha) {
  const d0 = new Date(fecha); d0.setMonth(d0.getMonth() - MESES);
  const desde = d0.toISOString().slice(0, 10);
  const rows = [], vistos = new Set();
  for (const medio of Object.keys(MEDIOS)) {
    const f = path.join(NDIR, `${medio}-${fecha}.json`);
    if (!fs.existsSync(f)) continue;
    for (const x of JSON.parse(fs.readFileSync(f, "utf8"))) {
      if (x.d < desde || vistos.has(medio + x.id)) continue; vistos.add(medio + x.id);
      const b = x.b || barriosDe(x.t + " . " + (x.lead || ""));
      if (!b.length || b.length >= 4 || AVISO.test(plain(x.t))) continue;
      let c = clasificar({ title: x.t, lead: x.lead });
      if (x.del != null && x.lead == null) { // archivo ya clasificado con la bajada: se respeta, con las reglas del título encima
        const del = c.del || (!!x.del && !MARCHA.test(plain(x.t)));
        c = { del, tono: del ? -1 : x.del ? c.tono : x.tono, deporte: c.deporte };
      }
      if (c.deporte) continue;
      rows.push({ s: medio, id: x.id, d: x.d, u: x.u, t: x.t, b, del: c.del, tono: c.tono, ev: null });
    }
  }
  agruparHechos(rows);
  rows.sort((a, b) => b.d.localeCompare(a.d));
  const fields = ["s", "id", "d", "u", "t", "b", "del", "tono", "ev"];
  const out = { date: fecha, desde, fuentes: MEDIOS, fields, rows: rows.map(r => fields.map(f => f === "del" ? (r.del ? 1 : 0) : r[f])) };
  fs.writeFileSync(path.join(DATA, "noticias.json"), JSON.stringify(out));
  return { notas: rows.length, hechos: new Set(rows.filter(r => r.del).map(r => r.ev)).size };
}

if (process.argv[2] === "--build") console.log(normalizar(process.argv[3]));
