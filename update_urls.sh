#!/bin/bash

# 1. Extraer las URLs actuales de los túneles
WEB_URL=$(docker logs tfg_cloudflare_tunnel_web 2>&1 | grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' | tail -n 1)
API_URL=$(docker logs tfg_cloudflare_tunnel_api 2>&1 | grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' | tail -n 1)

echo "Sincronizando URLs..."
echo "Web: $WEB_URL"
echo "API: $API_URL"

# 2. Actualizar el index.html (Frontend)
# Reemplaza cualquier URL de trycloudflare.com que encuentre en el fetch
FRONTEND_INDEX="/home/julio/tfg_project/frontend/index.html"
if [ -f "$FRONTEND_INDEX" ]; then
    sed -i "s|https://[a-zA-Z0-9-]*\.trycloudflare\.com/subir-nota|$API_URL/subir-nota|g" "$FRONTEND_INDEX"
    sed -i "s|https://[a-zA-Z0-9-]*\.trycloudflare\.com/obtener-nota|$API_URL/obtener-nota|g" "$FRONTEND_INDEX"
    echo "✅ index.html actualizado."
else
    echo "⚠️ No se encontró index.html en $FRONTEND_INDEX"
fi

# 3. Actualizar el script del QR (Para que el QR siempre apunte a la WEB)
QR_SCRIPT="/home/julio/tfg_project/generar_qr.py"
if [ -f "$QR_SCRIPT" ]; then
    sed -i "s|https://[a-zA-Z0-9-]*\.trycloudflare\.com|$WEB_URL|g" "$QR_SCRIPT"
    echo "✅ generar_qr.py actualizado."
fi

# 4. Regenerar el QR automáticamente
python3 /home/julio/tfg_project/generar_qr.py

echo "🚀 ¡Todo listo! Recarga la web en tu navegador."
