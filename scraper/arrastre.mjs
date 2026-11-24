// Si una fuente viene vacía o con mucho menos que en el relevamiento anterior (portal bloqueado, sitio caído),
// se mantienen sus filas anteriores en vez de darlas de baja a todas. El relevamiento guarda en `arrastradas`
// de qué fecha son los datos de cada fuente arrastrada, para que la app y las alertas lo sepan.
import fs from "node:fs";
import path from "node:path";

export const MINIMO = 0.5; // por debajo de esta fracción de lo que había, la fuente se considera caída

// Último relevamiento publicado en el índice (snapshots.json o alquileres.json), sin contar el de `fecha`.
export function anterior(dir, indice, fecha) {
  const f = path.join(dir, indice);
  if (!fs.existsSync(f)) return null;
  const files = JSON.parse(fs.readFileSync(f, "utf8")).files.filter(x => !x.includes(fecha)).sort();
  for (const x of files.reverse()) { const p = path.join(dir, x); if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8")); }
  return null;
}

// rows: filas nuevas (src en la columna 0). prev: relevamiento anterior o null.
// Devuelve { rows, arrastradas, log } con las fuentes caídas reemplazadas por sus filas anteriores.
export function arrastrar(rows, prev, minimo = MINIMO) {
  const arrastradas = {}, log = [];
  if (!prev?.rows?.length) return { rows, arrastradas, log };
  const cuenta = rs => rs.reduce((m, r) => (m[r[0]] = (m[r[0]] || 0) + 1, m), {});
  const ahora = cuenta(rows), antes = cuenta(prev.rows);
  let out = rows;
  for (const [src, n0] of Object.entries(antes)) {
    const n = ahora[src] || 0;
    if (n >= n0 * minimo) continue;
    const desde = prev.arrastradas?.[src] || prev.date;
    out = out.filter(r => r[0] !== src).concat(prev.rows.filter(r => r[0] === src));
    arrastradas[src] = desde;
    log.push(`${src}: ${n} filas (antes ${n0}) → se mantienen las ${n0} del ${desde}`);
  }
  return { rows: out, arrastradas, log };
}
