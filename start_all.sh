#!/bin/bash
# 1. Limpiar procesos viejos
pm2 stop all
pm2 delete all

# 2. Lanzar Ganache y Backend usando el ecosistema
pm2 start /root/tfg_project/ecosystem.config.js

# 3. Lanzar túnel y capturar URL
# Borramos log anterior para no leer URLs viejas
rm -f /root/tfg_project/tunnel.log
cloudflared tunnel --url http://localhost:3000 > /root/tfg_project/tunnel.log 2>&1 &

# Esperar a que el túnel genere la URL
sleep 8

# Extraer la URL
NEW_URL=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' /root/tfg_project/tunnel.log | head -n 1)

# 4. Actualizar el Frontend si la URL existe
if [ ! -z "$NEW_URL" ]; then
    sed -i "s|const API_URL = '.*';|const API_URL = '$NEW_URL';|" /root/tfg_project/frontend/index.html
    echo "Servidor listo en: $NEW_URL"
else
    echo "Error: No se pudo obtener la URL de Cloudflare"
fi
