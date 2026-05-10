#!/bin/bash

# =================================================================
# TFG: Sistema de Sellado Blockchain - Script de Inicio DevOps
# =================================================================

# Colores para logs más legibles
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Iniciando proceso de despliegue del Backend...${NC}"

# 1. Espera activa a Ganache y PostgreSQL.
# No usamos 'nc' porque no suele venir en imágenes de Node. Usamos /dev/tcp.
echo -e "${YELLOW}⏳ Esperando a que Ganache esté listo en tfg_ganache_final:8545...${NC}"
MAX_RETRIES=30
COUNT=0

while ! timeout 1s bash -c "echo > /dev/tcp/tfg_ganache_final/8545" 2>/dev/null; do
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo -e "${RED}❌ Error: Ganache no respondió tras $MAX_RETRIES segundos.${NC}"
    exit 1
  fi
  sleep 1
  ((COUNT++))
done

echo -e "${GREEN}✅ Ganache detectado y disponible.${NC}"

echo -e "${YELLOW}⏳ Esperando a que PostgreSQL esté listo en tfg_db:5432...${NC}"
COUNT=0
while ! timeout 1s bash -c "echo > /dev/tcp/tfg_db/5432" 2>/dev/null; do
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo -e "${RED}❌ Error: PostgreSQL no respondió tras $MAX_RETRIES segundos.${NC}"
    exit 1
  fi
  sleep 1
  ((COUNT++))
done

echo -e "${GREEN}✅ PostgreSQL detectado y disponible.${NC}"

# 2. Gestión de dependencias de Node.js
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 node_modules no encontrado. Instalando dependencias (npm install)...${NC}"
  npm install --silent
else
  echo -e "${GREEN}✅ Dependencias ya instaladas.${NC}"
fi

# 3. Despliegue de Smart Contracts (Truffle)
echo -e "${YELLOW}📜 Desplegando Smart Contracts en la red local...${NC}"
npx truffle migrate --network development --reset --compile-all
MIGRATION_STATUS=$?
if [ $MIGRATION_STATUS -ne 0 ]; then
  echo -e "${RED}❌ Falló el despliegue de contratos.${NC}"
  exit $MIGRATION_STATUS
fi

# 4. Arranque de la API
echo -e "${GREEN}🔥 Arrancando el servidor API en el puerto 3000...${NC}"
# Usamos exec para que Node reciba las señales de Docker (SIGTERM) correctamente
exec npm start
