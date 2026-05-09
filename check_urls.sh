#!/bin/bash
echo "------------------------------------------------"
echo "🔍 BUSCANDO URLS DE ACCESO (Cloudflare)..."
echo "------------------------------------------------"

API_URL=$(docker logs tfg_cloudflare_tunnel_api 2>&1 | grep -oE "https://[a-zA-Z0-9.-]+\.trycloudflare\.com" | tail -n 1)
WEB_URL=$(docker logs tfg_cloudflare_tunnel_web 2>&1 | grep -oE "https://[a-zA-Z0-9.-]+\.trycloudflare\.com" | tail -n 1)
GRAF_URL=$(docker logs tfg_cloudflare_tunnel_grafana 2>&1 | grep -oE "https://[a-zA-Z0-9.-]+\.trycloudflare\.com" | tail -n 1)

echo "🔗 API BACKEND:  $API_URL"
echo "🌐 PORTAL WEB:   $WEB_URL"
echo "📊 MONITORIZACIÓN: $GRAF_URL"
echo "------------------------------------------------"
