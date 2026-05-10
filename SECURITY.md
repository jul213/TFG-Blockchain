# SECURITY AUDIT REPORT (TFG)

Fecha de auditoría: 2026-05-10  
Alcance: `blockchain/contracts/*.sol`, `blockchain/server.js`, `docker-compose.yml`, `nginx/default.conf`, `frontend/index.html`

## Resumen Ejecutivo

Se detectaron riesgos críticos en autenticación backend, exposición de secretos y dependencia de red interna frágil.  
El stack fue reforzado manteniendo la lógica de negocio y rutas actuales.

## Hallazgos Smart Contracts (CVSS v3.1 + MITRE ATT&CK)

1. **Exposición de evidencia sensible en eventos on-chain**
- Contrato: `TFG_CyberShield_V2.sol`
- Riesgo: `IncidentReported` emite `_evidence` en claro. Queda público e inmutable.
- CVSS v3.1: `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N` = **6.5 (Medium)**
- MITRE ATT&CK (Blockchain): `Collection`, `Exfiltration`, `Discovery`
- Mitigación: emitir hash/token de evidencia y almacenar detalle fuera de cadena con control de acceso.

2. **Control de acceso operacional desacoplado entre API y emisor real on-chain**
- Contrato/API: `Notas.sol` + `server.js`
- Riesgo: la API emite siempre desde `accounts[0]`; no prueba identidad wallet del docente.
- CVSS v3.1: `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N` = **7.1 (High)**
- MITRE ATT&CK (Blockchain): `Privilege Escalation`, `Impair Process Control`
- Mitigación: exigir firma del cliente o mapear `user -> address` autorizado y usar cuenta dedicada por rol.

3. **Validación funcional incoherente de nota**
- Contrato: `Notas.sol`
- Riesgo: contrato permite `0..10`, UI sugería `0..100` (ya corregido en frontend/backend).
- CVSS v3.1: `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N` = **3.7 (Low)**
- MITRE ATT&CK (Blockchain): `Impact`
- Mitigación: validación alineada extremo a extremo (frontend+backend+contrato).

4. **Parada de emergencia sin trazabilidad de motivo**
- Contrato: `SecurityManager.sol`, `TFG_CyberShield_V2.sol`
- Riesgo: bloqueo operacional sin metadata causal forense suficiente.
- CVSS v3.1: `AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:L/A:H` = **5.9 (Medium)**
- MITRE ATT&CK (Blockchain): `Inhibit Response Function`, `Impact`
- Mitigación: evento de pausa con `reasonCode` y actor correlacionado con alerta SOC.

## Riesgos de Infraestructura/Backend detectados y mitigados

- Secretos hardcodeados en backend y compose.
- CORS permisivo (`*`) en API.
- Proxy Nginx contra IP interna fija de contenedor.
- Ausencia de Alertmanager para notificación de incidentes.

## Recomendaciones adicionales

1. Rotar inmediatamente credenciales y `JWT_SECRET` en entorno de demo.
2. Añadir control de rate limiting en `/api/login`.
3. Añadir firma EIP-712 para acciones críticas de profesor.
4. Incorporar análisis estático Solidity (Slither/Mythril) en CI.
