#!/bin/bash

# 1. Obtener URLs de los túneles
API_URL=$(docker logs tfg_cloudflare_tunnel_api 2>&1 | grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' | tail -n 1)
WEB_URL=$(docker logs tfg_cloudflare_tunnel_web 2>&1 | grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' | tail -n 1)

echo "🔗 API detectada: $API_URL"
echo "🌐 Web detectada: $WEB_URL"

# 2. Actualizar el index.html con la nueva URL de la API
if [ -f "./frontend/index.html" ]; then
    sed -i "s|https://.*\.trycloudflare\.com/subir-nota|$API_URL/subir-nota|g" ./frontend/index.html
    sed -i "s|https://.*\.trycloudflare\.com/obtener-nota|$API_URL/obtener-nota|g" ./frontend/index.html
    echo "✅ index.html sincronizado con la API."
fi

# 3. Actualizar y generar el QR con la URL de la WEB
sed -i "s|https://.*\.trycloudflare\.com|$WEB_URL|g" generar_qr.py
python3 generar_qr.py
echo "✅ QR actualizado para acceso móvil."

echo "🔥 ¡Sistema listo! Refresca la web."
