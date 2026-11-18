# Radar Angostura

Casas en venta en Villa La Angostura: mapa por barrio, listado con historial de precios y noticias por barrio (incluida la seguridad reportada en medios locales).

- **Sitio:** https://darioballerini.github.io/radar-angostura/ — GitHub Pages publica la rama `main` sola en cada push.
- **App:** `index.html`, un solo archivo sin build. Lee `data/snapshots.json` (lista de relevamientos), `data/snapshot-AAAA-MM-DD.json`, `data/vla-map.json` y `data/noticias.json`.

## Actualizar los datos

El scraper corre en la Mac con un Chromium visible (Zonaprop bloquea navegadores sin ventana y servidores en la nube):

```
cd scraper && npm install && npx playwright install chromium
npm run scrape
cd .. && git add data && git commit -m "Relevamiento $(date +%F)" && git push
```

`npm run scrape` genera `data/snapshot-<fecha>.json` (y lo suma a `data/snapshots.json`), los crudos de inmobiliarias en `data/locales/` y de noticias en `data/noticias/`, y `data/noticias.json`. Cada relevamiento nuevo alimenta el historial de precios y las variaciones por barrio. Con el push, el sitio se actualiza en un par de minutos.

## Actualización automática y alertas

- `scraper/actualizar.sh` corre el relevamiento, manda las alertas y hace push de `data/` (GitHub Pages se actualiza solo).
- `scraper/instalar-mac.sh` lo programa con launchd los domingos a las 10:00. Log en `~/Library/Logs/radar-angostura.log`.
- `scraper/alertas.mjs` compara los dos últimos relevamientos y avisa por Telegram las casas nuevas hasta el tope y las bajas de precio. Configuración en `~/.radar-angostura.env` (fuera del repo): `TELEGRAM_TOKEN`, `TELEGRAM_CHAT`, `TOPE_USD` y, opcional, `TOPE_ALQ`.

## Fuentes

- **Portales:** Argenprop y Zonaprop (`scraper/scrape.mjs`). MercadoLibre pide login: haría falta su API oficial.
- **Inmobiliarias locales** (`scraper/locales.mjs`): Patagónica (`pa`), Coldwell Banker Patagonia Lakes (`cb`), Campos Haedo (`ch`), Fanelli (`fa`), Vilaterra (`vi`), Rimos (`ri`) y AM Propiedades (`am`). Barrio por texto del aviso o por coordenadas dentro de los límites de `data/vla-map.json`. Rearmar solo esa parte: `node locales.mjs --build AAAA-MM-DD`. La app une duplicados entre fuentes (mismo precio, mismo barrio o uno sin barrio, mismos dormitorios y m² parecidos).
- **Alquileres** (`scraper/alquileres.mjs`): casas en alquiler permanente de Argenprop, Zonaprop, Patagónica, Coldwell Banker y AM Propiedades. Todo en pesos por mes: los avisos en dólares se pasan a pesos con el dólar oficial (venta) del día, tomado de dolarapi.com, y se guarda el monto original. Los temporarios y turísticos quedan afuera. Sale a `data/alquiler-AAAA-MM-DD.json` (índice `data/alquileres.json`). En la app se elige con el selector Venta / Alquiler. Rearmar: `node alquileres.mjs --build AAAA-MM-DD`.
- **Noticias** (`scraper/noticias.mjs`): Diario Andino y La Angostura Digital, últimos 12 meses. Barrio solo si se nombra en el título o el primer párrafo; clasificación por palabras clave en hecho delictivo, negativa, positiva o neutral; las notas de seguimiento del mismo hecho cuentan una vez. Es seguridad *reportada*, no estadística oficial. Rearmar: `node noticias.mjs --build AAAA-MM-DD`.
- **Mapa** (`map/`): calles, lagos y límites de barrio de OpenStreetMap; `map/build_map.py` arma `data/vla-map.json`. Los barrios sin límite oficial en OSM son aproximados (borde punteado).
