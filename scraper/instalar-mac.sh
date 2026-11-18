#!/bin/bash
# Programa el relevamiento semanal en esta Mac (domingos 10:00) con launchd.
# Antes: npm install && npx playwright install chromium, y ~/.radar-angostura.env con TELEGRAM_TOKEN, TELEGRAM_CHAT y TOPE_USD.
# Para desinstalar: launchctl unload ~/Library/LaunchAgents/ar.radar-angostura.plist && rm ~/Library/LaunchAgents/ar.radar-angostura.plist
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
PL="$HOME/Library/LaunchAgents/ar.radar-angostura.plist"
chmod +x "$DIR/actualizar.sh"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>ar.radar-angostura</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DIR/actualizar.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/radar-angostura.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/radar-angostura.log</string>
</dict></plist>
PLIST
launchctl unload "$PL" 2>/dev/null || true
launchctl load "$PL"
echo "Listo: corre los domingos a las 10:00 (si la Mac está dormida, al despertarse). Log: ~/Library/Logs/radar-angostura.log"
