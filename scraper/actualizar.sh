#!/bin/bash
# Relevamiento semanal: scrapea, avisa por Telegram y publica en GitHub Pages.
# Lo corre launchd (ver instalar-mac.sh); también se puede correr a mano: ./scraper/actualizar.sh
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
# launchd no carga el perfil de la terminal: si node está instalado con nvm, hay que cargarlo a mano.
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then set +u; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; set -u; fi
command -v node >/dev/null || export PATH="$(ls -d "$NVM_DIR"/versions/node/*/bin 2>/dev/null | sort -V | tail -1):$PATH"
command -v node >/dev/null || { echo "node no encontrado"; exit 1; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== $(date '+%F %T') ==="
cd "$REPO" && git pull --rebase -q || echo "git pull falló, sigo con la copia local"
cd "$REPO/scraper" && node scrape.mjs || { echo "El relevamiento falló"; exit 1; }
node alertas.mjs || echo "Las alertas fallaron"
cd "$REPO" && git add data && git commit -q -m "Relevamiento $(date +%F)" && git push -q && echo "Publicado en GitHub Pages"
