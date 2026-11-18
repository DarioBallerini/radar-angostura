#!/bin/bash
# Relevamiento semanal: scrapea, avisa por Telegram y publica en GitHub Pages.
# Lo corre launchd (ver instalar-mac.sh); también se puede correr a mano: ./scraper/actualizar.sh
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== $(date '+%F %T') ==="
cd "$REPO" && git pull --rebase -q || echo "git pull falló, sigo con la copia local"
cd "$REPO/scraper" && node scrape.mjs || { echo "El relevamiento falló"; exit 1; }
node alertas.mjs || echo "Las alertas fallaron"
cd "$REPO" && git add data && git commit -q -m "Relevamiento $(date +%F)" && git push -q && echo "Publicado en GitHub Pages"
