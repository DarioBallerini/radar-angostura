// Fecha de publicación de los avisos de Zonaprop, estimada por número de aviso.
// Zonaprop numera los avisos en orden (unos 8.000 por día), así que con algunos avisos de fecha conocida
// se interpola la de cualquier otro. data/zonaprop-ids.json guarda esos puntos y se amplía en cada relevamiento.
import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../data/zonaprop-ids.json");
const DAY = 864e5;
const leer = () => JSON.parse(fs.readFileSync(FILE, "utf8"));

export function estimar(id) {
  const P = leer().puntos.map(([n, d]) => [n, Date.parse(d + "T12:00:00Z")]).sort((a, b) => a[0] - b[0]);
  id = Number(id);
  let i = P.findIndex(p => p[0] >= id);
  if (i === 0 && P[0][0] === id) return new Date(P[0][1]).toISOString().slice(0, 10);
  let a, b;
  if (i === -1) { a = P.at(-2); b = P.at(-1); } else if (i === 0) { a = P[0]; b = P[1]; } else { a = P[i - 1]; b = P[i]; }
  const t = a[1] + (id - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
  return new Date(Math.min(t, Date.now())).toISOString().slice(0, 10);
}

// Lee la antigüedad que muestra Zonaprop en unos pocos avisos y suma esos puntos al archivo.
export async function calibrar(page, ids, fecha, n = 8) {
  const s = [...ids].map(Number).sort((a, b) => a - b), pick = [];
  for (let i = 0; i < n; i++) pick.push(s[Math.round(i * (s.length - 1) / (n - 1))]);
  const hoy = Date.parse(fecha + "T12:00:00Z"), j = leer(), nuevos = [];
  for (const id of [...new Set(pick)]) {
    try {
      await page.goto(`https://www.zonaprop.com.ar/propiedades/clasificado/veclcain-casa-${id}.html`, { waitUntil: "domcontentloaded" });
      const h = await page.content();
      const a = (h.match(/const antiquity\s*=\s*'([^']*)'/) || [])[1] || "";
      const d = /hoy/.test(a) ? 0 : /ayer/.test(a) ? 1 : +((a.match(/hace (\d+) d/) || [])[1] ?? NaN);
      if (!isNaN(d)) nuevos.push([id, new Date(hoy - d * DAY).toISOString().slice(0, 10)]);
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2500 + Math.random() * 1500));
  }
  const m = new Map(j.puntos); for (const [id, d] of nuevos) m.set(id, d);
  j.puntos = [...m.entries()].sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(FILE, JSON.stringify(j));
  return nuevos.length;
}
