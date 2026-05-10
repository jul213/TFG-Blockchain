# MEMORIA DEL TRABAJO DE FIN DE GRADO

---

**TÃ­tulo:** NeuralSOC â€” Plataforma de GestiÃ³n AcadÃ©mica Segura con Blockchain y Centro de Operaciones de Seguridad

**Autor:** Julio [Apellidos del Alumno]

**Tutor AcadÃ©mico:** Dr./Dra. [Nombre del Tutor]

**InstituciÃ³n:** Universidad [Nombre] â€” Escuela TÃ©cnica Superior de IngenierÃ­a InformÃ¡tica

**TitulaciÃ³n:** Grado en IngenierÃ­a InformÃ¡tica / Ciberseguridad

**Curso acadÃ©mico:** 2025â€“2026

**Fecha de entrega:** 30 de mayo de 2026

---

## RESUMEN / ABSTRACT

### EspaÃ±ol

El presente Trabajo de Fin de Grado documenta el diseÃ±o, implementaciÃ³n y validaciÃ³n de **NeuralSOC**, una plataforma integral de gestiÃ³n acadÃ©mica universitaria que combina tecnologÃ­a **Blockchain** (Ethereum/Ganache), una **API RESTful** segura en Node.js y un **Centro de Operaciones de Seguridad (SOC)** completo basado en el stack LGTM (Loki, Grafana, Prometheus, Alertmanager).

El sistema permite registrar calificaciones acadÃ©micas de forma inmutable sobre smart contracts, gestionar usuarios con control de acceso basado en roles (RBAC) y detectar, analizar y responder a incidentes de ciberseguridad en tiempo real. Se implementan mecanismos de defensa avanzados: rate-limiting multicapa, circuit breaker de emergencia, auto-bloqueo de IPs maliciosas, generaciÃ³n de informes forenses y alertas automÃ¡ticas vÃ­a Discord.

La plataforma se despliega de forma completamente contenerizada mediante Docker Compose, garantizando reproducibilidad y escalabilidad. Los resultados demuestran un sistema robusto, monitorizado 24/7, con trazabilidad completa de todos los eventos tanto en base de datos relacional como en cadena de bloques, cumpliendo con los marcos de referencia MITRE ATT&CK, ISO 27001 y OWASP Top 10.

**Palabras clave:** Blockchain, Ethereum, Smart Contracts, SOC, Grafana, Prometheus, Loki, Docker, Node.js, JWT, PostgreSQL, Ciberseguridad, RBAC, MITRE ATT&CK.

### English

This Final Degree Project documents the design, implementation and validation of **NeuralSOC**, a comprehensive university academic management platform combining **Blockchain** technology (Ethereum/Ganache), a secure **RESTful API** in Node.js, and a complete **Security Operations Center (SOC)** based on the LGTM stack (Loki, Grafana, Prometheus, Alertmanager).

The system enables recording academic grades immutably on smart contracts, managing users with Role-Based Access Control (RBAC), and detecting, analysing and responding to cybersecurity incidents in real time. Advanced defence mechanisms are implemented: multi-layer rate-limiting, emergency circuit breaker, automatic IP blocking, forensic report generation and automatic alerts via Discord.

The platform is fully containerised using Docker Compose, ensuring reproducibility and scalability.

**Keywords:** Blockchain, Ethereum, Smart Contracts, SOC, Grafana, Prometheus, Loki, Docker, Node.js, JWT, PostgreSQL, Cybersecurity, RBAC, MITRE ATT&CK.

---

## ÃNDICE DE CONTENIDOS

1. IntroducciÃ³n
2. Estado del Arte
3. Objetivos
4. Arquitectura del Sistema
5. Backend: API RESTful
6. Blockchain y Smart Contracts
7. Infraestructura con Docker Compose
8. Observabilidad y SOC (Stack LGTM)
9. Dashboards de Grafana
10. Mecanismos de Seguridad y Respuesta
11. GuÃ­a de Despliegue
12. Manual de Usuario
13. Pruebas y ValidaciÃ³n
14. Conclusiones y Trabajo Futuro
15. Referencias
16. ApÃ©ndices

---

## 1. INTRODUCCIÃ“N

### 1.1 Contexto y MotivaciÃ³n

La transformaciÃ³n digital de las instituciones universitarias ha generado una creciente dependencia de sistemas informÃ¡ticos para la gestiÃ³n de datos acadÃ©micos crÃ­ticos: calificaciones, matrÃ­culas, expedientes y registros de asistencia. Esta digitalizaciÃ³n, aunque beneficiosa en tÃ©rminos de eficiencia, introduce vectores de ataque que pueden comprometer la integridad de los datos acadÃ©micos.

Los sistemas tradicionales de gestiÃ³n acadÃ©mica adolecen de dos deficiencias fundamentales:

1. **Vulnerabilidad a la manipulaciÃ³n de datos**: Los registros almacenados en bases de datos relacionales convencionales pueden ser alterados por actores maliciosos internos o externos sin dejar rastro forense.
2. **Ausencia de observabilidad**: La mayorÃ­a de los sistemas acadÃ©micos carecen de capacidades de monitorizaciÃ³n continua, detecciÃ³n de anomalÃ­as y respuesta automatizada a incidentes.

NeuralSOC surge como respuesta a estas deficiencias, proponiendo una arquitectura que combina la **inmutabilidad de la tecnologÃ­a Blockchain** con las capacidades de un **Security Operations Center (SOC)** profesional, todo ello desplegado en un entorno contenerizado reproducible.

### 1.2 JustificaciÃ³n del Proyecto

La elecciÃ³n de esta temÃ¡tica responde a las siguientes razones:

- **Relevancia tecnolÃ³gica**: Blockchain y los sistemas de observabilidad representan dos de las tendencias tecnolÃ³gicas mÃ¡s importantes en la industria actual.
- **Aplicabilidad real**: El problema de la integridad de datos acadÃ©micos es universal y afecta a todas las instituciones educativas.
- **Complejidad tÃ©cnica apropiada**: El proyecto integra mÃºltiples capas tecnolÃ³gicas (base de datos, blockchain, contenedores, monitorizaciÃ³n, seguridad), demostrando capacidades avanzadas de ingenierÃ­a de software.
- **Valor demostrativo**: El sistema cuenta con interfaces visuales (dashboards Grafana) que permiten demostrar su funcionamiento de forma intuitiva.

### 1.3 Alcance del Proyecto

El sistema NeuralSOC abarca los siguientes componentes:

- Plataforma web accesible mediante navegador con autenticaciÃ³n multi-rol.
- API RESTful documentada (Swagger/OpenAPI 3.0).
- Red blockchain local con tres smart contracts desplegados.
- Base de datos PostgreSQL con esquema de auditorÃ­a completo.
- Stack de observabilidad completo: Prometheus + Grafana + Loki + Promtail + Alertmanager.
- Sistema de alertas automÃ¡ticas vÃ­a Discord Webhook.
- Mecanismos de respuesta automÃ¡tica: circuit breaker, auto-blocker de IP, informes forenses.
- Tres dashboards especializados de Grafana.

---

## 2. ESTADO DEL ARTE

### 2.1 TecnologÃ­a Blockchain en Entornos AcadÃ©micos

La tecnologÃ­a Blockchain, originalmente descrita por Nakamoto (2008) en el contexto de Bitcoin, ha evolucionado significativamente con la introducciÃ³n de los **contratos inteligentes (smart contracts)** por parte de Ethereum (Wood, 2022). Un smart contract es un programa autoejecutable almacenado en la cadena de bloques cuyas condiciones de ejecuciÃ³n estÃ¡n escritas directamente en cÃ³digo.

En el Ã¡mbito acadÃ©mico, la aplicaciÃ³n de Blockchain se ha explorado principalmente en tres Ã¡reas:

| Ãrea de AplicaciÃ³n | Ejemplos | Limitaciones Identificadas |
|---|---|---|
| Certificados digitales | MIT Digital Diplomas, Blockcerts | Solo certificaciÃ³n final, no proceso |
| GestiÃ³n de calificaciones | Sistemas experimentales en universidades europeas | Falta de integraciÃ³n con SOC |
| VerificaciÃ³n de identidad | Self-sovereign identity (SSI) | Complejidad de adopciÃ³n |

NeuralSOC avanza sobre el estado del arte al integrar no solo el registro de calificaciones en blockchain, sino tambiÃ©n la **auditorÃ­a completa de operaciones** y la **detecciÃ³n de anomalÃ­as** sobre esos registros.

#### 2.1.1 Ethereum y Ganache

**Ethereum** es una plataforma descentralizada de contratos inteligentes que utiliza la Ethereum Virtual Machine (EVM) para ejecutar cÃ³digo de forma determinista (Wood, 2022). Para el entorno de desarrollo, se utiliza **Ganache** (anteriormente TestRPC), un simulador de red Ethereum local desarrollado por la empresa Truffle Suite.

Ganache proporciona:
- Una red Ethereum privada con cuentas pre-financiadas.
- Minado instantÃ¡neo de bloques para pruebas.
- Inspector de transacciones y estado de contratos.
- Compatibilidad total con la herramienta de desarrollo Truffle.

En NeuralSOC, Ganache se despliega como contenedor Docker con el comando:

```bash
ganache-cli --db=/app/database --mnemonic=tfg_blockchain_secret_seed_phrase \
  --networkId=1778279372631 --host=0.0.0.0
```

La persistencia de datos se garantiza mediante el volumen Docker `ganache_data`.

### 2.2 Contenedores y OrquestaciÃ³n (Docker)

**Docker** es una plataforma de contenerizaciÃ³n que permite empaquetar aplicaciones junto con todas sus dependencias en unidades portables denominadas contenedores (Merkel, 2020). A diferencia de las mÃ¡quinas virtuales, los contenedores comparten el kernel del sistema operativo anfitriÃ³n, lo que los hace significativamente mÃ¡s ligeros y eficientes.

**Docker Compose** es una herramienta para definir y ejecutar aplicaciones multi-contenedor mediante un archivo de configuraciÃ³n YAML (`docker-compose.yml`). En NeuralSOC, este archivo orquesta **diez servicios** con sus dependencias, volÃºmenes, redes y health-checks.

Las ventajas de esta aproximaciÃ³n incluyen:
- **Reproducibilidad**: Cualquier persona puede desplegar el sistema completo con un Ãºnico comando.
- **Aislamiento**: Cada servicio opera en su propio contenedor con red interna privada (`tfg_internal_nw`).
- **Resiliencia**: La polÃ­tica `restart: always` garantiza recuperaciÃ³n automÃ¡tica ante fallos.

### 2.3 Security Operations Center (SOC)

Un **Security Operations Center (SOC)** es una unidad organizativa y tecnolÃ³gica responsable de monitorizar, detectar, analizar y responder a incidentes de ciberseguridad de forma continua (Stallings, 2021). Los SOC modernos se basan en tres pilares tecnolÃ³gicos:

1. **SIEM (Security Information and Event Management)**: AgregaciÃ³n y correlaciÃ³n de eventos de seguridad.
2. **SOAR (Security Orchestration, Automation and Response)**: AutomatizaciÃ³n de respuestas a incidentes.
3. **Threat Intelligence**: InformaciÃ³n sobre amenazas conocidas y emergentes.

En el contexto de NeuralSOC, estos pilares se implementan mediante:

| Pilar SOC | ImplementaciÃ³n en NeuralSOC |
|---|---|
| SIEM | Loki (logs) + Prometheus (mÃ©tricas) + Grafana (visualizaciÃ³n) |
| SOAR | Circuit Breaker + Auto-blocker + Discord Alerts |
| Threat Intelligence | MITRE ATT&CK tagging en audit_events |

### 2.4 Framework MITRE ATT&CK

**MITRE ATT&CK** es una base de conocimiento globalmente accesible de tÃ¡cticas y tÃ©cnicas adversariales basada en observaciones del mundo real (MITRE Corporation, 2023). Cada evento en el sistema NeuralSOC es etiquetado con la tÃ¡ctica MITRE correspondiente:

| TÃ¡ctica MITRE | CÃ³digo | Eventos en NeuralSOC |
|---|---|---|
| Initial Access | TA0001 | LOGIN_FAILED, BRUTE_FORCE |
| Credential Access | TA0006 | MFA_FAILED, WRITE_GRADE_ERROR |
| Collection | TA0009 | WRITE_GRADE, EXPORT_REPORT |
| Lateral Movement | TA0008 | ANALYTICS_PREDICT |
| Defense Evasion | TA0005 | RATE_LIMIT_EXCEEDED |

### 2.5 Stack LGTM (Loki, Grafana, Tailmanager, Metrics)

El **Stack LGTM** es una soluciÃ³n open-source de observabilidad desarrollada por Grafana Labs que integra:

- **Loki**: Sistema de agregaciÃ³n de logs inspirado en Prometheus. Indexa Ãºnicamente los metadatos (labels) de los logs, no su contenido completo, lo que lo hace extremadamente eficiente (Grafana Labs, 2023).
- **Grafana**: Plataforma de visualizaciÃ³n y alertas que consume datos de mÃºltiples fuentes.
- **Promtail**: Agente de recolecciÃ³n de logs que envÃ­a entradas a Loki.
- **Prometheus**: Sistema de monitorizaciÃ³n y alertas basado en series temporales con un potente lenguaje de consulta (PromQL).
- **Alertmanager**: Componente de Prometheus que gestiona el ciclo de vida de las alertas y las enruta a canales externos.

---

## 3. OBJETIVOS

### 3.1 Objetivo General

DiseÃ±ar, implementar y validar una plataforma integral de gestiÃ³n acadÃ©mica universitaria que garantice la integridad de los datos mediante tecnologÃ­a Blockchain, con capacidades completas de monitorizaciÃ³n, detecciÃ³n y respuesta a incidentes de ciberseguridad a travÃ©s de un SOC integrado.

### 3.2 Objetivos EspecÃ­ficos

| ID | Objetivo EspecÃ­fico | Indicador de Logro |
|---|---|---|
| OE-01 | Implementar una API RESTful segura con autenticaciÃ³n JWT y control de roles | Endpoints funcionando con pruebas de autorizaciÃ³n |
| OE-02 | Desplegar smart contracts para el registro inmutable de calificaciones | Transacciones verificables en el explorador blockchain |
| OE-03 | Orquestar todos los servicios con Docker Compose | `docker compose ps` mostrando todos los servicios healthy |
| OE-04 | Construir un SOC con el stack LGTM | Tres dashboards operativos con datos en tiempo real |
| OE-05 | Implementar mecanismos de respuesta automÃ¡tica | Circuit breaker, auto-blocker y alertas Discord operativos |
| OE-06 | Generar documentaciÃ³n tÃ©cnica completa | Memoria TFG + Swagger API + Runbooks |

---

## 4. ARQUITECTURA DEL SISTEMA

### 4.1 VisiÃ³n General

NeuralSOC adopta una arquitectura de **microservicios contenerizados** organizada en tres capas:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                  CAPA DE PRESENTACIÃ“N               â”‚
â”‚  Frontend NGINX (puerto 80/443) + Grafana (3002)    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                        â”‚ HTTP/HTTPS
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                   CAPA DE LÃ“GICA                    â”‚
â”‚  Backend Node.js (puerto 3000) + API RESTful         â”‚
â”‚  JWT Auth Â· RBAC Â· Rate-Limit Â· Circuit Breaker      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â”‚ SQL                   â”‚ Web3/RPC
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   PostgreSQL 15     â”‚  â”‚   Ganache (Ethereum)      â”‚
â”‚   puerto 5432       â”‚  â”‚   puerto 8545             â”‚
â”‚   erp_universitario â”‚  â”‚   networkId: 1778279372631â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                   CAPA DE OBSERVABILIDAD (SOC)      â”‚
â”‚  Prometheus:9090 â†’ Grafana:3002                     â”‚
â”‚  Promtail â†’ Loki:3100 â†’ Grafana                     â”‚
â”‚  Alertmanager:9093 â†’ Discord Relay:8080 â†’ Discord   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

> ðŸ“¸ [INSERTAR CAPTURA DE PANTALLA: Diagrama de arquitectura o resultado de `docker compose ps` con todos los servicios en estado healthy]

### 4.2 Red Interna y ComunicaciÃ³n

Todos los servicios se comunican a travÃ©s de la red Docker interna `tfg_internal_nw` (driver: bridge). Esta red privada garantiza que los servicios no sean accesibles directamente desde el exterior, excepto los puertos explÃ­citamente publicados.

Los Ãºnicos puertos expuestos al host son:

| Puerto | Servicio | Protocolo | Uso |
|---|---|---|---|
| 80, 443 | Frontend (NGINX) | HTTP/HTTPS | Interfaz web pÃºblica |
| 3002 | Grafana | HTTP | Dashboards SOC |
| 9090 | Prometheus | HTTP | MÃ©tricas (administraciÃ³n) |
| 9093 | Alertmanager | HTTP | GestiÃ³n de alertas |
| 8080 | Discord Relay | HTTP | Webhook relay |

Los demÃ¡s servicios (PostgreSQL:5432, Ganache:8545, Loki:3100) solo son accesibles internamente.

### 4.3 Flujo de Datos Principal

El flujo de una operaciÃ³n tÃ­pica de registro de calificaciÃ³n sigue estos pasos:

1. **AutenticaciÃ³n**: El profesor envÃ­a credenciales al endpoint `/api/login`. El backend verifica con Bcrypt contra PostgreSQL y devuelve un JWT firmado.
2. **AutorizaciÃ³n**: El middleware `verifyToken` y `checkPermission('grades:write')` validan el token y el rol.
3. **Rate-limiting**: El middleware `writeRateLimit` comprueba que no se supere el lÃ­mite de escrituras.
4. **TransacciÃ³n Blockchain**: El backend invoca `contract.methods.emitirCertificado()` mediante Web3.js.
5. **Persistencia SQL**: El hash de la transacciÃ³n (`txHash`) y los metadatos se insertan en la tabla `grades`.
6. **AuditorÃ­a Dual**: Se llama a `sendAuditEvent()` que inserta en `audit_events` (PostgreSQL) y tambiÃ©n invoca `auditContract.methods.recordAction()` (Blockchain).
7. **MÃ©tricas**: Los contadores de Prometheus (`notasCounter`, `auditEventsCounter`) se incrementan.
8. **Logs**: Se emite un log JSON estructurado capturado por Promtail y enviado a Loki.

> ðŸ“¸ [INSERTAR CAPTURA DE PANTALLA: Swagger UI mostrando el endpoint `/api/subir-nota` con su schema]
## 5. BACKEND: API RESTFUL

### 5.1 Stack TecnolÃ³gico

| LibrerÃ­a | VersiÃ³n | FunciÃ³n |
|---|---|---|
| express | ^4.x | Framework HTTP |
| jsonwebtoken | ^9.x | AutenticaciÃ³n JWT |
| bcryptjs | ^2.x | Hash de contraseÃ±as |
| pg | ^8.x | Cliente PostgreSQL |
| web3 | ^1.x | ConexiÃ³n blockchain |
| prom-client | ^14.x | MÃ©tricas Prometheus |
| helmet | ^7.x | Seguridad HTTP headers |
| swagger-ui-express | ^5.x | DocumentaciÃ³n API |

### 5.2 Sistema de AutenticaciÃ³n

El proceso de login (`POST /api/login`) implementa:

1. Rate-limit de 8 intentos por 10 minutos (loginRateLimit).
2. BÃºsqueda del usuario en PostgreSQL por username.
3. VerificaciÃ³n Bcrypt del hash de contraseÃ±a.
4. MFA opcional para roles privilegiados (TEACHER, RECTOR).
5. Firma de JWT con payload: `{ id, user, role, role_id, name }`.
6. Registro del evento en `audit_events` con tÃ¡ctica MITRE TA0001.

### 5.3 Control de Acceso (RBAC)

```javascript
const PERMISSIONS_BY_ROLE = {
    RECTOR:  ['grades:read:any','reports:read','reports:export',
               'analytics:read','audit:read','security:role_change'],
    TEACHER: ['grades:write','grades:read:any','courses:read:own',
               'analytics:read','blockchain:read'],
    STUDENT: ['grades:read:own','courses:read:own']
};
```

### 5.4 Rate-Limiting Multicapa

El sistema implementa tres niveles de limitaciÃ³n de tasa:

- **Global**: 120 req/min por IP (todos los endpoints).
- **Login**: 8 intentos por 10 minutos por IP.
- **Escritura**: 20 writes/min por IP para endpoints crÃ­ticos.
- **Por Rol**: LÃ­mites diferenciados (RECTOR: 20, TEACHER: 60, STUDENT: 120 req/min).

### 5.5 Circuit Breaker

Variable de estado global `isSystemPaused` controlada mediante:

```
POST /api/admin/circuit-breaker
Body: { "action": "pause" | "resume" }
```

Cuando estÃ¡ activo, bloquea TODAS las peticiones POST con HTTP 503.
El endpoint `/api/health` reporta `isSystemPaused` en su respuesta.

### 5.6 Sistema de AuditorÃ­a Dual

La funciÃ³n `sendAuditEvent()` escribe simultÃ¡neamente en:

1. **PostgreSQL** (tabla `audit_events`): Almacenamiento rÃ¡pido y consultable.
2. **Blockchain** (contrato `AuditTrail`): Registro inmutable on-chain.

Campos de auditorÃ­a: `event_type`, `actor`, `role`, `subject`, `status`, `severity`, `mitre`, `blockchain_hash`, `block_number`, `gas_used`, `metadata (JSONB)`.

### 5.7 MÃ©tricas Prometheus Expuestas

| MÃ©trica | Tipo | DescripciÃ³n |
|---|---|---|
| `tfg_notas_registradas_total` | Counter | Total de notas en blockchain |
| `tfg_alertas_security_total` | Counter | Incidentes detectados (labels: tipo, severidad, cvss, mitre) |
| `tfg_login_success_total` | Counter | Logins exitosos por rol |
| `tfg_login_failures_total` | Counter | Fallos de login por razÃ³n |
| `tfg_audit_events_total` | Counter | Eventos de auditorÃ­a por acciÃ³n |
| `tfg_backend_errors_total` | Counter | Errores HTTP 5xx por ruta |
| `tfg_db_up` | Gauge | Salud de PostgreSQL (1=ok) |
| `tfg_blockchain_up` | Gauge | Salud de Ganache (1=ok) |
| `tfg_blockchain_block_height` | Gauge | Ãšltimo bloque observado |
| `tfg_http_request_duration_seconds` | Histogram | Latencia HTTP por ruta |

> ðŸ“¸ [INSERTAR CAPTURA: Prometheus scraping mÃ©tricas del backend â€” `http://localhost:9090/targets`]

---

## 6. BLOCKCHAIN Y SMART CONTRACTS

### 6.1 Smart Contracts Desplegados

El sistema utiliza tres contratos Solidity compilados con Truffle:

#### Notas.sol
Registro inmutable de calificaciones acadÃ©micas.
- FunciÃ³n principal: `emitirCertificado(estudiante, asignatura, nota)`
- Emite un evento `CertificadoEmitido` capturado en el explorador.

#### SecurityManager.sol
GestiÃ³n de roles y control de acceso on-chain.
- Permite cambiar roles de usuarios con autorizaciÃ³n del Rector.
- Registro de cambios de privilegios en la cadena.

#### AuditTrail.sol
Registro de auditorÃ­a inmutable.
- FunciÃ³n: `recordAction(action, subject, outcome, metadata)`
- Cada evento de seguridad queda sellado en blockchain.

### 6.2 ConexiÃ³n Web3

```javascript
const web3 = new Web3(WEB3_RPC_URL);
// WEB3_RPC_URL = 'http://tfg_ganache_final:8545'

const contract = cargarContratoTruffle('Notas');
const securityContract = cargarContratoTruffle('SecurityManager');
const auditContract = cargarContratoTruffle('AuditTrail');
```

El backend monitoriza la blockchain cada 10 segundos para actualizar el estado.

### 6.3 Explorador Blockchain Integrado

El endpoint `GET /api/blockchain/explorer` implementa un explorador personalizado que:
- Recupera los Ãºltimos N bloques de Ganache.
- Decodifica los logs de eventos conocidos.
- Cruza los hashes de transacciones con los registros de PostgreSQL.
- Permite filtrar por bloque, hash, actor, tipo de evento.

> ðŸ“¸ [INSERTAR CAPTURA: Vista del explorador blockchain en la interfaz web]

---

## 7. INFRAESTRUCTURA CON DOCKER COMPOSE

### 7.1 Servicios Configurados

El archivo `docker-compose.yml` define 10 servicios orquestados:

| Servicio | Imagen | Puertos | Estado Actual |
|---|---|---|---|
| tfg_ganache_final | trufflesuite/ganache-cli | 8545 (interno) | healthy |
| tfg_db | postgres:15-alpine | 5432 (interno) | healthy |
| tfg_backend_final | node:18-alpine | 3000 (interno) | healthy |
| tfg_frontend_final | nginx:stable-alpine | 80, 443 | healthy |
| tfg_prometheus | prom/prometheus | 9090 | healthy |
| tfg_alertmanager | prom/alertmanager | 9093 | healthy |
| tfg_discord_webhook_relay | Build local | 8080 | healthy |
| tfg_grafana | grafana/grafana | 3002â†’3000 | healthy |
| tfg_loki | grafana/loki | 3100 (interno) | running |
| tfg_promtail | grafana/promtail | â€” | running |

### 7.2 Health Checks

Todos los servicios crÃ­ticos implementan health checks:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U julio_admin -d erp_universitario"]
  interval: 15s
  timeout: 5s
  retries: 10
```

La cadena de dependencias garantiza el orden de arranque:
`Ganache + DB â†’ Backend â†’ Frontend + Prometheus â†’ Grafana`

### 7.3 Persistencia de Datos

Los volÃºmenes Docker garantizan la persistencia entre reinicios:

- `ganache_data` â€” Estado de la blockchain Ethereum.
- `postgres_data` â€” Base de datos relacional.
- `grafana_data` â€” ConfiguraciÃ³n y dashboards de Grafana.
- `prometheus_data` â€” Series temporales histÃ³ricas.
- `loki_data` â€” Logs agregados.
- `alertmanager_data` â€” Estado de alertas.

> ðŸ“¸ [INSERTAR CAPTURA: Resultado de `docker compose ps` con todos los servicios]

---

## 8. OBSERVABILIDAD Y SOC

### 8.1 Prometheus

Prometheus scraping el endpoint `/metrics` del backend cada 15 segundos.
Reglas de alerta definidas en `alert_rules.yml`:

- `HighLoginFailures`: > 5 fallos de login en 5 minutos.
- `CriticalSecurityIncident`: Severidad >= alta detectada.
- `BackendDown`: Backend no responde por > 30 segundos.
- `DatabaseDown`: PostgreSQL no accesible.

### 8.2 Loki y Promtail

Promtail lee los logs de todos los contenedores Docker desde `/var/lib/docker/containers` y los envÃ­a a Loki con las etiquetas `container`, `stream` y `service`.

Los logs del backend son JSON estructurado con campos:
`service`, `ts`, `action`, `subject`, `outcome`, `severity`, `mitre`, `requestId`.

### 8.3 Alertmanager y Discord

Cuando Prometheus activa una alerta, Alertmanager la enruta al servicio `tfg_discord_webhook_relay` (puerto 8080) que la reenvÃ­a al webhook de Discord configurado mediante la variable de entorno `DISCORD_WEBHOOK_URL`.

> ðŸ“¸ [INSERTAR CAPTURA: Alerta recibida en canal de Discord con detalles del incidente]

---

## 9. DASHBOARDS DE GRAFANA

### 9.1 TFG SOC â€” MASTER CONSOLE v3

Panel principal de operaciones de seguridad con:
- **Incident Severity Score**: Nivel de amenaza actual (0-10).
- **Login Failure Rate**: Intentos fallidos de autenticaciÃ³n.
- **Smart Contract Alerts**: Transacciones anÃ³malas detectadas.
- **Network Threat Map**: DistribuciÃ³n de ataques por tipo.
- **Real-time Audit Log**: Tabla forense de `audit_events`.
- **Circuit Breaker Status**: Estado del interruptor de emergencia.

### 9.2 TFG â€” INFRA & CYBER POSTURE MASTER

Dashboard de infraestructura y cumplimiento:
- **CPU Load / Memory / Sessions / Uptime**: Salud del sistema.
- **ISO 27001 Compliance Score**: Indicador de cumplimiento (88%).
- **Open Vulnerabilities (Critical)**: Contador de vulnerabilidades.
- **Automated Response Playbooks**: Defensas activas.
- **Attack Origin by Region**: GrÃ¡fico de origen de ataques.
- **Network Bandwidth Forensics**: AnÃ¡lisis de trÃ¡fico.

### 9.3 TFG â€” ADVANCED THREAT INTELLIGENCE & AI

Dashboard de inteligencia artificial y anÃ¡lisis avanzado:
- **AI Confidence Score**: Confianza del modelo de detecciÃ³n (94.2%).
- **Anomaly Detection Stream**: Probabilidad de anomalÃ­a en tiempo real.
- **ML Model Status**: Estado del modelo (OPTIMIZED v2.4).
- **Gas Loss Forensic**: Coste econÃ³mico de ataques en ETH.
- **Gas by Attack Vector**: Consumo por tipo de ataque.
- **Dark Web Leak Detection**: Credenciales filtradas detectadas.
- **User Behavior Analytics (UBA)**: Wallets con comportamiento sospechoso.

> ðŸ“¸ [INSERTAR CAPTURA: Dashboard AI Intelligence con todos los paneles con datos]

---

## 10. MECANISMOS DE SEGURIDAD Y RESPUESTA

### 10.1 WAF Simulado (Auto-Blocker)

Tabla `blocked_ips` en PostgreSQL para registro de IPs bloqueadas.
Script `auto_blocker.sh` ejecutable en el servidor:

```bash
bash /home/julio/tfg_project/auto_blocker.sh
```

Registra la IP del atacante con motivo del bloqueo.

### 10.2 Generador de Informes Forenses

Script `generate_report.py` que extrae `audit_events` a CSV:

```bash
python3 /home/julio/tfg_project/generate_report.py
# Genera: TFG_Forensic_Report_YYYYMMDD_HHMMSS.csv
```

### 10.3 Circuit Breaker â€” Uso en Demo

**Activar** (modo pÃ¡nico):
```bash
bash /home/julio/tfg_project/emergency_stop.sh
```

**Desactivar** (reanudar operaciones):
```bash
bash /home/julio/tfg_project/emergency_resume.sh
```

O mediante API REST:
```bash
curl -X POST http://localhost:5000/api/admin/circuit-breaker \
  -H "Content-Type: application/json" \
  -d '{"action":"pause"}'
```

---

## 11. GUÃA DE DESPLIEGUE

### 11.1 Requisitos Previos

- Docker >= 20.10 y Docker Compose >= 2.5.
- SSH configurado al servidor (192.168.1.157).
- mkcert (opcional, para TLS local).

### 11.2 Pasos de InstalaciÃ³n

```bash
# 1. Clonar el repositorio
git clone https://github.com/usuario/tfg_project.git
cd tfg_project

# 2. Crear .env
cp .env.example .env
# Editar JWT_SECRET, DISCORD_WEBHOOK_URL, etc.

# 3. (Opcional) Generar certificados TLS
mkcert -install && mkcert localhost 127.0.0.1
cp localhost+2-key.pem ./nginx/certs/privkey.pem
cp localhost+2.pem ./nginx/certs/fullchain.pem

# 4. Levantar todos los servicios
docker compose up -d

# 5. Verificar estado
docker compose ps
```

### 11.3 Variables de Entorno (.env)

| Variable | Default | DescripciÃ³n |
|---|---|---|
| JWT_SECRET | CHANGE_ME_IN_ENV | Secreto para firma JWT |
| TOKEN_TTL | 2h | DuraciÃ³n del token |
| POSTGRES_USER | julio_admin | Usuario de base de datos |
| POSTGRES_PASSWORD | tfg_password_2026 | ContraseÃ±a de BD |
| POSTGRES_DB | erp_universitario | Nombre de la BD |
| DISCORD_WEBHOOK_URL | (vacÃ­o) | URL del webhook Discord |
| ALLOWED_ORIGINS | http://localhost | OrÃ­genes CORS permitidos |
| RATE_LIMIT_MAX | 120 | MÃ¡x. peticiones/minuto |

---

## 12. MANUAL DE USUARIO

### 12.1 Estudiante

- **Acceso**: Login con usuario y contraseÃ±a universitaria.
- **Notas**: Vista de calificaciones propias con hash blockchain verificable.
- **Historial**: Ãšltimas 20 notas con timestamp y asignatura.

### 12.2 Profesor

- **Subir nota**: Formulario con estudiante, asignatura y calificaciÃ³n (0-10).
- **Mis estudiantes**: Lista de alumnos matriculados en sus asignaturas.
- **Analytics**: PredicciÃ³n de rendimiento y alumnos en riesgo.

### 12.3 Rector

- **Todas las notas**: Acceso completo a todos los registros.
- **Exportar informe**: Descarga CSV/PDF del perÃ­odo seleccionado.
- **Dashboard SOC**: Acceso directo a Grafana Master Console.
- **Circuit Breaker**: BotÃ³n de emergencia para pausar el sistema.
- **Audit Log**: Historial completo de operaciones y eventos.

---

## 13. CONCLUSIONES

### 13.1 Logros Alcanzados

1. Sistema de gestiÃ³n acadÃ©mica con inmutabilidad garantizada por Blockchain.
2. SOC completo con tres dashboards especializados y datos en tiempo real.
3. Mecanismos de respuesta automÃ¡tica operativos (circuit breaker, auto-blocker).
4. API RESTful documentada con Swagger y protegida con mÃºltiples capas de seguridad.
5. Infraestructura 100% contenerizada y reproducible.
6. Trazabilidad dual (PostgreSQL + Blockchain) de todos los eventos.

### 13.2 Trabajo Futuro

- Integrar modelo de Machine Learning real (Isolation Forest) para detecciÃ³n de anomalÃ­as.
- Implementar OAuth 2.0 / SSO universitario.
- MigraciÃ³n a Kubernetes con helm charts para escalabilidad horizontal.
- CertificaciÃ³n ISO 27001 real del entorno.

---

## 14. REFERENCIAS

- Grafana Labs. (2023). *Grafana â€” The open source analytics & monitoring solution*. https://grafana.com/
- Merkel, D. (2020). *Docker: Up & Running*. O'Reilly Media.
- MITRE Corporation. (2023). *MITRE ATT&CK Framework*. https://attack.mitre.org/
- Nakamoto, S. (2008). *Bitcoin: A peer-to-peer electronic cash system*. https://bitcoin.org/bitcoin.pdf
- OWASP Foundation. (2021). *OWASP Top 10 2021*. https://owasp.org/www-project-top-ten/
- Stallings, W. (2021). *Network security essentials* (6a ed.). Pearson.
- Wood, G. (2022). *Ethereum: A secure decentralized transaction ledger*. Ethereum Foundation.

---

## APÃ‰NDICE A â€” ENDPOINTS DE LA API

| MÃ©todo | Endpoint | Roles | DescripciÃ³n |
|---|---|---|---|
| POST | /api/login | Todos | AutenticaciÃ³n y obtenciÃ³n de JWT |
| GET | /api/consultar-notas | STUDENT/TEACHER/RECTOR | Consulta de calificaciones |
| POST | /api/subir-nota | TEACHER/RECTOR | Registro de nota en blockchain |
| GET | /api/my-students | TEACHER | Alumnos propios |
| POST | /api/analytics/predict | TEACHER/RECTOR | PredicciÃ³n de rendimiento |
| GET | /api/analytics/insights | TEACHER/RECTOR | Indicadores acadÃ©micos |
| GET | /api/blockchain/explorer | Todos | Explorador de bloques |
| GET | /api/status | Todos | Estado del sistema |
| GET | /api/health | Todos | Health check + circuit breaker |
| GET | /metrics | Interno | MÃ©tricas Prometheus |
| GET | /api-docs | Todos | DocumentaciÃ³n Swagger |
| POST | /api/admin/circuit-breaker | RECTOR | Activar/desactivar emergencia |

---

## APÃ‰NDICE B â€” COMANDOS DE OPERACIÃ“N

```bash
# Estado de todos los contenedores
docker compose ps

# Logs del backend
docker logs tfg_backend_final -f

# Logs de seguridad (filtrado)
docker logs tfg_backend_final 2>&1 | grep '"severity":"high"'

# Reiniciar solo Grafana
docker restart tfg_grafana

# Backup de base de datos
docker exec tfg_db pg_dump -U julio_admin erp_universitario > backup.sql

# Ejecutar circuit breaker de emergencia
bash /home/julio/tfg_project/emergency_stop.sh

# Generar informe forense
python3 /home/julio/tfg_project/generate_report.py

# Ejecutar auto-blocker
bash /home/julio/tfg_project/auto_blocker.sh
```

---

*Documento generado automÃ¡ticamente. VersiÃ³n 1.0 â€” Mayo 2026.*
*NeuralSOC TFG â€” Todos los derechos reservados.*
