# Arquitectura TFG CyberShield SGU

## Componentes
- Frontend estático Nginx: SPA por rol, PDF rectoral, estado de servicios y mini explorer.
- Backend Express: API, JWT, RBAC por permiso, validación, métricas Prometheus, Web3 y Postgres.
- Postgres: usuarios, cursos, notas selladas y `audit_events` para trazabilidad cruzada.
- Ganache + contratos: `Notas`, `SecurityManager` y `AuditTrail`.
- SOC: Prometheus, Loki, Promtail, Grafana, Alertmanager y relay Discord.

## Flujo De Datos
- El frontend genera `X-Request-Id` por llamada.
- El backend conserva o crea `request_id`, lo devuelve en `X-Request-Id` y lo añade a respuestas, logs, auditoría y tablas.
- Al subir nota, el backend escribe en contrato `Notas`, guarda la transacción en `grades` y registra `WRITE_GRADE` en `audit_events` y `AuditTrail`.
- Grafana/Loki permiten buscar por `request_id` para seguir una acción desde navegador hasta blockchain.

## Trust Boundaries
- Navegador a Nginx: TLS local, CSP, HSTS y cabeceras de seguridad.
- Nginx a backend: red interna Docker, proxy con `X-Request-Id`.
- Backend a Postgres/Ganache: red interna Docker, credenciales por entorno.
- Alertmanager a Discord relay: payload filtrado y enriquecido, webhook aislado por variable.

## Matriz RBAC
- `RECTOR`: informes, exportación, auditoría, integridad, observabilidad, explorer y analítica.
- `TEACHER`: subir notas, consultar notas, cursos propios, asistencia y analítica.
- `STUDENT`: consultar notas propias y cursos propios.

## MITRE Y Controles
- `TA0001`: login fallido, MFA y alertas de autenticación.
- `TA0004`: cambios de rol auditados.
- `TA0006`: errores de credenciales, MFA o escritura sensible.
- `TA0008`: predicción/analytics y disponibilidad de backend.
- `TA0009`: escritura de nota y disponibilidad de DB.
- `TA0010`: exportación de informes.
- `TA0040`: disponibilidad Ganache, Loki y Grafana.
