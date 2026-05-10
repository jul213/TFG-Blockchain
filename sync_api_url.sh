#!/bin/bash

# Función para extraer la URL del log de un contenedor
get_url() {
    docker logs $1 2>&1 | grep -o 'https://[-a-z0-9.]*trycloudflare.com' | tail -n 1
}

echo "📡 Iniciando rastreo de nuevas URLs..."

# Intentar hasta 3 veces
for i in {1..3}; do
    echo "🔄 Intento $i de 3 - Buscando..."
    
    API_URL=$(get_url tfg_cloudflare_tunnel_api)
    WEB_URL=$(get_url tfg_cloudflare_tunnel_web)
    GRAFANA_URL=$(get_url tfg_cloudflare_tunnel_grafana)

    if [ ! -z "$API_URL" ] && [ ! -z "$WEB_URL" ]; then
        echo "✅ URLs capturadas con éxito."
        break
    else
        echo "⏳ Aún no aparecen, esperando 10 segundos..."
        sleep 10
    fi
done

echo "----------------------------------------------------------------"
echo "📍 API: ${API_URL:-'Vacio'}"
echo "🌐 WEB: ${WEB_URL:-'Vacio'}"
echo "📊 GRAFANA: ${GRAFANA_URL:-'Vacio'}"
echo "----------------------------------------------------------------"

if [ ! -z "$API_URL" ]; then
    echo "🔧 Actualizando frontend/index.html..."
    sed -i "s|const API_URL =.*|const API_URL = \"$API_URL\";|g" frontend/index.html
    
    echo "📱 Generando código QR para la Web..."
    python3 generar_qr.py "$WEB_URL"
    
    echo "🚀 Reiniciando Nginx para aplicar cambios..."
    docker restart tfg_frontend_final > /dev/null
    
    echo "✨ ¡SISTEMA LISTO!"
    echo "Copia esta URL en tu navegador: $WEB_URL"
else
    echo "❌ ERROR CRÍTICO: Los túneles no han generado URLs."
    echo "Prueba a ver el log manualmente: docker logs tfg_cloudflare_tunnel_web"
fi
