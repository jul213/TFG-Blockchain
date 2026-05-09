#!/bin/bash

# 1. Extraer las URLs actuales de los túneles
WEB_URL=$(docker logs tfg_cloudflare_tunnel_web 2>&1 | grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' | tail -n 1)
API_URL=$(docker logs tfg_cloudflare_tunnel_api 2>&1 | grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' | tail -n 1)

echo "Sincronizando URLs..."
echo "Web: $WEB_URL"
echo "API: $API_URL"

# 2. Actualizar el index.html (Frontend)
# Reemplaza cualquier URL de trycloudflare.com que encuentre en el fetch
if [ -f "~/tfg_project/frontend/index.html" ]; then
    sed -i "s|https://[a-zA-Z0-9-]*\.trycloudflare\.com/subir-nota|$API_URL/subir-nota|g" ~/tfg_project/frontend/index.html
    sed -i "s|https://[a-zA-Z0-9-]*\.trycloudflare\.com/obtener-nota|$API_URL/obtener-nota|g" ~/tfg_project/frontend/index.html
    echo "✅ index.html actualizado."
else
    # Si estás dentro de la carpeta frontend usa esta ruta:
    sed -i "s|https://[a-zA-Z0-9-]*\.trycloudflare\.com/subir-nota|$API_URL/subir-nota|g" index.html
    sed -i "s|https://[a-zA-Z0-9-]*\.trycloudflare\.com/obtener-nota|$API_URL/obtener-nota|g" index.html
    echo "✅ index.html actualizado (ruta local)."
fi

# 3. Actualizar el script del QR (Para que el QR siempre apunte a la WEB)
sed -i "s|https://[a-zA-Z0-9-]*\.trycloudflare\.com|$WEB_URL|g" ~/tfg_project/generar_qr.py
echo "✅ generar_qr.py actualizado."

# 4. Regenerar el QR automáticamente
python3 ~/tfg_project/generar_qr.py

echo "🚀 ¡Todo listo! Recarga la web en tu navegador."
