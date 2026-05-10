# Runbooks SOC

## BackendDown
- Confirmar `docker compose ps tfg_backend_final`.
- Revisar logs en Loki por `{container_name="tfg_backend_final"}` y filtrar por `requestId`.
- Validar `/api/health-check` y dependencias Postgres/Ganache.

## Backend5xxHigh
- Abrir panel SOC en Grafana.
- Buscar errores con `status_code=~"5.."` y correlacionar `request_id`.
- Revisar últimos eventos en `/api/audit/events`.

## LoginFailedAnomaly
- Revisar `tfg_login_failures_total` por ventana de 10 minutos.
- Buscar eventos `LOGIN_FAILED` y `LOGIN_MFA_FAILED`.
- Bloquear o rotar credenciales si el actor coincide con rol privilegiado.

## GanacheStalled
- Validar altura en `/api/status`.
- Revisar `tfg_blockchain_last_block_age_seconds`.
- Si el contrato no responde, reiniciar Ganache y relanzar `bootstrap.js` para desplegar artefactos.

## DatabaseDown
- Confirmar `pg_isready` dentro de `tfg_db`.
- Ejecutar backup si el volumen responde: `scripts/backup_postgres.sh`.
- Restaurar con `scripts/restore_postgres.sh <dump.sql>` solo tras confirmar integridad.
