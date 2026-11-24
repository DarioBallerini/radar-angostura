// Avisos por Telegram después de cada relevamiento: casas nuevas hasta tu tope y bajas de precio.
// Lee la configuración de ~/.radar-angostura.env (fuera del repo):
//   TELEGRAM_TOKEN=...   TELEGRAM_CHAT=...   TOPE_USD=200000   (opcional TOPE_ALQ=pesos por mes)
// Uso: node alertas.mjs            (compara los dos últimos relevamientos)
//      node alertas.mjs --prueba   (manda el resumen aunque no haya novedades, para probar)
//      node alertas.mjs --seco     (muestra el mensaje en pantalla sin mandarlo)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DATA = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../data");
const env = Object.fromEntries((fs.existsSync(path.join(os.homedir(), ".radar-angostura.env")) ? fs.readFileSync(path.join(os.homedir(), ".radar-angostura.env"), "utf8") : "")
  .split("\n").map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
const cfg = { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(TELEGRAM_|TOPE_)/.test(k))) };
if (!cfg.TELEGRAM_TOKEN || !cfg.TELEGRAM_CHAT) { console.error("Falta TELEGRAM_TOKEN o TELEGRAM_CHAT en ~/.radar-angostura.env"); process.exit(1); }
const PAGINA = "https://darioballerini.github.io/radar-angostura/";

const fmt = n => Math.round(n).toLocaleString("es-AR");
const leer = idx => { const f = path.join(DATA, idx); if (!fs.existsSync(f)) return []; return JSON.parse(fs.readFileSync(f, "utf8")).files.map(x => JSON.parse(fs.readFileSync(path.join(DATA, x), "utf8"))).sort((a, b) => a.date.localeCompare(b.date)); };
const filas = s => s.rows.map(r => Object.fromEntries(s.fields.map((f, i) => [f, r[i]])));
const url = (s, o) => (s.sources?.[o.src]?.[1] || "").replace("{slug}", o.slug || "villa-la-angostura").replace("{id}", o.id);
// la misma casa publicada en varios sitios se avisa una sola vez
const clave = o => [o.price, o.barrio, o.dorm ?? "", o.m2cub ? Math.round(o.m2cub / 10) : ""].join("|");

function comparar(snaps, tope, moneda) {
  if (snaps.length < 2) return null;
  const [a, b] = snaps.slice(-2), A = new Map(filas(a).map(o => [o.src + ":" + o.id, o])), visto = new Set(filas(a).map(clave));
  const nuevas = new Map(), bajas = new Map();
  for (const o of filas(b)) {
    if (o.price > tope) continue;
    const prev = A.get(o.src + ":" + o.id);
    if (!prev) { if (!visto.has(clave(o)) && !nuevas.has(clave(o))) nuevas.set(clave(o), { ...o, link: url(b, o) }); }
    else if (o.price < prev.price) { const k = clave(o); if (!bajas.has(k)) bajas.set(k, { ...o, antes: prev.price, link: url(b, o) }); }
  }
  const linea = o => `• ${o.barrio} · ${o.dorm != null ? o.dorm + " dorm · " : ""}${o.m2cub ? o.m2cub + " m² · " : ""}<b>${moneda} ${fmt(o.price)}</b>${o.antes ? ` (antes ${fmt(o.antes)}, −${Math.round((1 - o.price / o.antes) * 100)}%)` : ""}\n  <a href="${o.link}">ver aviso</a>`;
  return { fecha: b.date, arrastradas: b.arrastradas || {}, sources: b.sources || {}, nuevas: [...nuevas.values()].sort((x, y) => x.price - y.price), bajas: [...bajas.values()].sort((x, y) => (x.price / x.antes) - (y.price / y.antes)), linea };
}

async function enviar(texto) {
  if (process.argv.includes("--seco")) { console.log(texto); return; }
  const r = await fetch(`https://api.telegram.org/bot${cfg.TELEGRAM_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: cfg.TELEGRAM_CHAT, text: texto, parse_mode: "HTML", disable_web_page_preview: true }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.description);
}

const partes = [];
const tope = +(cfg.TOPE_USD || 200000);
const v = comparar(leer("snapshots.json"), tope, "USD");
if (v) {
  const max = 15;
  if (v.nuevas.length) partes.push(`🏡 <b>${v.nuevas.length} casa${v.nuevas.length > 1 ? "s" : ""} nueva${v.nuevas.length > 1 ? "s" : ""} hasta USD ${fmt(tope)}</b>\n` + v.nuevas.slice(0, max).map(v.linea).join("\n") + (v.nuevas.length > max ? `\n…y ${v.nuevas.length - max} más` : ""));
  if (v.bajas.length) partes.push(`📉 <b>${v.bajas.length} ${v.bajas.length > 1 ? "bajaron" : "bajó"} de precio</b>\n` + v.bajas.slice(0, max).map(v.linea).join("\n") + (v.bajas.length > max ? `\n…y ${v.bajas.length - max} más` : ""));
}
if (cfg.TOPE_ALQ) {
  const a = comparar(leer("alquileres.json"), +cfg.TOPE_ALQ, "$");
  if (a?.nuevas.length) partes.push(`🔑 <b>Alquileres nuevos hasta $ ${fmt(+cfg.TOPE_ALQ)}/mes</b>\n` + a.nuevas.map(a.linea).join("\n"));
}
// fuentes que no se pudieron leer: se avisa siempre, aunque no haya novedades
const caidas = Object.entries(v?.arrastradas || {});
let aviso = "";
if (caidas.length) {
  const porFecha = {};
  for (const [src, f] of caidas) (porFecha[f] ??= []).push(v.sources[src]?.[0] || src);
  aviso = Object.entries(porFecha).map(([f, ns]) => `⚠️ No se pudo leer ${ns.join("/")}: se mantienen los datos del ${f}`).join("\n");
  partes.push(aviso);
}
const fecha = v?.fecha || new Date().toISOString().slice(0, 10);
const seco = process.argv.includes("--seco");
let enviado = false;
if (partes.length) { enviado = true; await enviar(`<b>Radar Angostura · relevamiento del ${fecha}</b>\n\n${partes.join("\n\n")}\n\n<a href="${PAGINA}">Abrir el radar</a>`); }
else if (process.argv.includes("--prueba") || process.argv.includes("--siempre")) { enviado = true; await enviar(`<b>Radar Angostura · ${fecha}</b>\nSin casas nuevas hasta USD ${fmt(tope)} ni bajas de precio${v ? "" : " (hace falta un segundo relevamiento para comparar)"}.\n<a href="${PAGINA}">Abrir el radar</a>`); }
console.log(`Alertas: ${v ? `${v.nuevas.length} nuevas, ${v.bajas.length} bajas` : "sin relevamiento anterior"}${caidas.length ? `, ${caidas.length} fuente(s) arrastrada(s)` : ""} · ${enviado ? (seco ? "no enviado (modo seco)" : "enviado") : "nada para avisar"}`);
