#!/bin/bash

echo "🔍 Buscando URLs de los túneles..."

# 1. Extraer la URL del túnel de la API específicamente
API_URL=$(docker logs tfg_cloudflare_tunnel_api 2>&1 | grep -o 'https://[^ ]*trycloudflare.com' | tail -n 1)

# 2. Extraer la URL del túnel de la WEB específicamente (por si quieres mostrarla al final)
WEB_URL=$(docker logs tfg_cloudflare_tunnel_web 2>&1 | grep -o 'https://[^ ]*trycloudflare.com' | tail -n 1)

if [ -z "$API_URL" ]; then
    echo "❌ Error: No se pudo encontrar la URL de la API. ¿Están los túneles encendidos?"
    exit 1
fi

echo "📍 API URL detectada: $API_URL"
echo "🌐 WEB URL detectada: $WEB_URL"

# 3. Aplicar el cambio en el index.html del Frontend
echo "🔧 Actualizando API_URL en el Frontend..."
docker exec tfg_frontend_final sed -i "s|const API_URL = '.*';|const API_URL = '$API_URL';|g" /usr/share/nginx/html/index.html

# 4. Reiniciar el servidor web para asegurar que sirve el archivo nuevo
echo "🚀 Reiniciando servidor web..."
docker restart tfg_frontend_final

echo "✨ ¡Sincronización completada con éxito!"
echo "👉 Entra por aquí: $WEB_URL"
