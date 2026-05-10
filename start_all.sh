#!/bin/bash
# 1. Limpiar procesos viejos
pm2 stop all
pm2 delete all

# 2. Lanzar Ganache y Backend usando el ecosistema correcto
pm2 start /home/julio/tfg_project/ecosystem.config.js

# 3. Lanzar túnel y capturar URL
# Borramos log anterior para no leer URLs viejas
rm -f /home/julio/tfg_project/tunnel.log
cloudflared tunnel --url http://localhost:3000 > /home/julio/tfg_project/tunnel.log 2>&1 &

# Esperar a que el túnel genere la URL
sleep 8

# Extraer la URL
NEW_URL=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' /home/julio/tfg_project/tunnel.log | head -n 1)

# 4. Actualizar el Frontend si la URL existe
if [ ! -z "$NEW_URL" ]; then
    sed -i "s|const API_URL = '.*';|const API_URL = '$NEW_URL';|" /home/julio/tfg_project/frontend/index.html
    echo "Servidor listo en: $NEW_URL"
else
    echo "Error: No se pudo obtener la URL de Cloudflare"
fi
