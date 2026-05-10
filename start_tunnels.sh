#!/bin/bash
# Matar procesos previos de ngrok
pkill -9 ngrok

# 1. API con dominio estático
ngrok http 3000 --url reprogram-boat-slacked.ngrok-free.dev > /home/julio-javier/tfg_project/ngrok_api.log 2>&1 &

# 2. WEB (Frontend)
ngrok http 8080 > /home/julio-javier/tfg_project/ngrok_web.log 2>&1 &

# 3. GRAFANA (Puerto 3001 del host que va al 3000 del contenedor)
ngrok http 3001 > /home/julio-javier/tfg_project/ngrok_grafana.log 2>&1 &

echo "🚀 Túneles lanzados."
