const express = require('express');
const cors = require('cors');
const Web3 = require('web3');
const http = require('http');
const crypto = require('crypto');
const client = require('prom-client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_ENV';
const DB_HOST = process.env.DB_HOST || 'tfg_db';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_USER = process.env.DB_USER || 'julio_admin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'tfg_password_2026';
const DB_NAME = process.env.DB_NAME || 'erp_universitario';
const WEB3_RPC_URL = process.env.WEB3_RPC_URL || 'http://tfg_ganache_final:8545';
const TOKEN_TTL = process.env.TOKEN_TTL || '2h';
const MFA_SHARED_CODE = process.env.MFA_SHARED_CODE || '';
const SECURITY_ADMIN_TOKEN = process.env.SECURITY_ADMIN_TOKEN || '';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3002';
const GRAFANA_URL = process.env.GRAFANA_URL || 'http://localhost:3002';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost,http://127.0.0.1,https://localhost,https://127.0.0.1')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);
const REPORT_WINDOW_DAYS = Number(process.env.REPORT_WINDOW_DAYS || 30);
let isSystemPaused = false; // NeuralSOC Circuit Breaker State


if (JWT_SECRET === 'CHANGE_ME_IN_ENV') {
    console.warn('[WARN] JWT_SECRET is using default value. Set it in environment for production/demo.');
}

app.use(helmet());
app.use(cors({
    origin(origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS policy'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// --- CONFIGURACIÓN SWAGGER ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'TFG NeuralSOC API',
            version: '2.0.0',
            description: 'API Documentada para TFG',
        },
        servers: [
            { url: `http://localhost:${PORT}` }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: ['./server.js'], // El propio archivo tiene los comentarios JSDoc
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


app.use((req, res, next) => {
    const inbound = String(req.headers['x-request-id'] || '').trim();
    const requestId = /^[a-zA-Z0-9._:-]{8,80}$/.test(inbound) ? inbound : crypto.randomUUID();
    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            if (payload.success === false && !payload.error) {
                const message = payload.message || 'Error';
                return originalJson({
                    success: false,
                    error: {
                        code: payload.code || 'REQUEST_FAILED',
                        message,
                        details: payload.details || null,
                        requestId
                    },
                    message,
                    requestId
                });
            }
            if (!payload.requestId) {
                return originalJson({ requestId, ...payload });
            }
        }
        return originalJson(payload);
    };
    next();
});

const safeJson = (payload) => {
    try {
        return JSON.stringify(payload);
    } catch (_error) {
        return JSON.stringify({ service: 'tfg_backend', action: 'serialize_error' });
    }
};

const sanitizeText = (value) => String(value ?? '')
    .trim()
    .replace(/[<>"'`]/g, '')
    .replace(/\s+/g, ' ');

const sanitizeIdentifier = (value) => sanitizeText(value)
    .replace(/[^a-zA-Z0-9@._\-+\s]/g, '')
    .slice(0, 150);

const sanitizeSubject = (value) => sanitizeText(value).slice(0, 120);
const sanitizeName = (value) => sanitizeText(value).slice(0, 100);
const isValidAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(String(value || ''));
const isPrivilegedRole = (role) => ['TEACHER', 'RECTOR'].includes(role);
const isValidTxHash = (value) => /^0x[a-fA-F0-9]{64}$/.test(String(value || ''));
const parseBoundedInt = (value, fallback, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.trunc(parsed), min), max);
};

const createRateLimiter = ({ windowMs, max }) => {
    const hits = new Map();
    return (req, res, next) => {
        const key = `${req.ip}:${req.path}`;
        const now = Date.now();
        const bucket = hits.get(key) || [];
        const recent = bucket.filter((ts) => now - ts < windowMs);
        recent.push(now);
        hits.set(key, recent);
        if (recent.length > max) {
            res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
            recordSecurityIncident('RATE_LIMIT_EXCEEDED', 2, '3.5', 'TA0042');
            emitStructuredLog({
                service: 'tfg_backend',
                action: 'rate_limit_exceeded',
                status: 'fail',
                severity: 'medium',
                mitre: 'TA0042',
                route: req.path,
                requestId: req.requestId
            });
            return apiFail(res, 429, 'RATE_LIMIT_EXCEEDED', 'Demasiadas peticiones. Reintenta más tarde.');
        }
        next();
    };
};

const globalRateLimit = createRateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX });
const loginRateLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 8) });
const writeRateLimit = createRateLimiter({ windowMs: 60 * 1000, max: Number(process.env.WRITE_RATE_LIMIT_MAX || 20) });

app.use(globalRateLimit);

// --- 1. CONFIGURACIÓN DE POSTGRES ---
const pool = new Pool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT,
});

const ensureDatabaseShape = async () => {
    const statements = [
        "ALTER TABLE grades ADD COLUMN IF NOT EXISTS request_id VARCHAR(80)",
        "ALTER TABLE grades ADD COLUMN IF NOT EXISTS block_number INTEGER",
        "ALTER TABLE grades ADD COLUMN IF NOT EXISTS gas_used INTEGER",
        "ALTER TABLE grades ADD COLUMN IF NOT EXISTS event_type VARCHAR(80) DEFAULT 'WRITE_GRADE'",
        `CREATE TABLE IF NOT EXISTS audit_events (
            id SERIAL PRIMARY KEY,
            request_id VARCHAR(80),
            event_type VARCHAR(80) NOT NULL,
            actor VARCHAR(150),
            role VARCHAR(20),
            subject VARCHAR(180),
            status VARCHAR(32) NOT NULL,
            severity VARCHAR(20) DEFAULT 'low',
            mitre VARCHAR(20) DEFAULT 'TA0000',
            db_id INTEGER,
            blockchain_hash VARCHAR(100),
            block_number INTEGER,
            gas_used INTEGER,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        "CREATE INDEX IF NOT EXISTS idx_audit_events_request_id ON audit_events(request_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type)",
        "CREATE INDEX IF NOT EXISTS idx_audit_events_blockchain_hash ON audit_events(blockchain_hash)",
        "CREATE INDEX IF NOT EXISTS idx_grades_request_id ON grades(request_id)",
        "CREATE INDEX IF NOT EXISTS idx_grades_blockchain_hash ON grades(blockchain_hash)"
    ];
    for (const statement of statements) {
        await pool.query(statement);
    }
};

const databaseShapeReady = ensureDatabaseShape().catch((error) => {
    console.warn(`[WARN] No se pudo asegurar el esquema extendido: ${error.message}`);
});

// --- 2. CONFIGURACIÓN DE MÉTRICAS ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const notasCounter = new client.Counter({
    name: 'tfg_notas_registradas_total',
    help: 'Total de notas selladas en la Blockchain'
});

const alertsCounter = new client.Counter({
    name: 'tfg_alertas_security_total',
    help: 'Total de incidentes detectados',
    labelNames: ['tipo', 'severidad', 'cvss', 'mitre_tactic']
});

const loginSuccessCounter = new client.Counter({
    name: 'tfg_login_success_total',
    help: 'Successful login attempts',
    labelNames: ['role']
});

const loginFailureCounter = new client.Counter({
    name: 'tfg_login_failures_total',
    help: 'Failed login attempts',
    labelNames: ['reason', 'role']
});

const reportExportCounter = new client.Counter({
    name: 'tfg_report_exports_total',
    help: 'Rectoral report exports'
});

const auditEventsCounter = new client.Counter({
    name: 'tfg_audit_events_total',
    help: 'Blockchain audit events emitted',
    labelNames: ['action', 'status', 'role']
});

const backendErrorsCounter = new client.Counter({
    name: 'tfg_backend_errors_total',
    help: 'Total backend errors captured',
    labelNames: ['route', 'status', 'kind']
});

register.registerMetric(notasCounter);
register.registerMetric(alertsCounter);
register.registerMetric(loginSuccessCounter);
register.registerMetric(loginFailureCounter);
register.registerMetric(reportExportCounter);
register.registerMetric(auditEventsCounter);
register.registerMetric(backendErrorsCounter);

const dbHealthGauge = new client.Gauge({
    name: 'tfg_db_up',
    help: 'Database health status (1=up, 0=down)'
});

const blockchainHealthGauge = new client.Gauge({
    name: 'tfg_blockchain_up',
    help: 'Blockchain node health status (1=up, 0=down)'
});

const blockchainBlockHeightGauge = new client.Gauge({
    name: 'tfg_blockchain_block_height',
    help: 'Latest known blockchain block height'
});

const blockchainBlockAgeGauge = new client.Gauge({
    name: 'tfg_blockchain_last_block_age_seconds',
    help: 'Age in seconds of the latest blockchain block'
});

const requestDuration = new client.Histogram({
    name: 'tfg_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

const httpRequestsTotal = new client.Counter({
    name: 'tfg_http_requests_total',
    help: 'Total HTTP requests handled by the API',
    labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(dbHealthGauge);
register.registerMetric(blockchainHealthGauge);
register.registerMetric(blockchainBlockHeightGauge);
register.registerMetric(blockchainBlockAgeGauge);
register.registerMetric(requestDuration);
register.registerMetric(httpRequestsTotal);

const web3 = new Web3(WEB3_RPC_URL);
let lastObservedBlockNumber = 0;
let lastObservedBlockTimestamp = 0;

const recordSecurityIncident = (tipo, severidad, cvss = '0', mitreTactic = 'TA0000') => {
    alertsCounter.inc({
        tipo: sanitizeIdentifier(tipo).slice(0, 60) || 'UNKNOWN',
        severidad: String(severidad || 0),
        cvss: String(cvss || '0').slice(0, 16),
        mitre_tactic: String(mitreTactic || 'TA0000').slice(0, 16)
    });
};

const emitStructuredLog = (entry) => {
    console.log(safeJson({
        service: 'tfg_backend',
        ts: new Date().toISOString(),
        ...entry
    }));
};

const recordBackendError = (route, status, kind = 'internal') => {
    backendErrorsCounter.inc({ route, status: String(status), kind });
};

const updateBlockchainState = async () => {
    try {
        const blockNumber = await web3.eth.getBlockNumber();
        lastObservedBlockNumber = blockNumber;
        blockchainBlockHeightGauge.set(blockNumber);
        const latestBlock = await web3.eth.getBlock(blockNumber).catch(() => null);
        if (latestBlock?.timestamp) {
            lastObservedBlockTimestamp = Number(latestBlock.timestamp);
            const age = Math.max(0, Math.floor(Date.now() / 1000) - Number(latestBlock.timestamp));
            blockchainBlockAgeGauge.set(age);
        }
    } catch (_error) {
        blockchainBlockHeightGauge.set(0);
        blockchainBlockAgeGauge.set(0);
    }
};

app.use((req, res, next) => {
    const route = req.path.replace(/\/\d+(?=\/|$)/g, '/:id');
    const timer = requestDuration.startTimer({ method: req.method, route });
    res.on('finish', () => {
        timer({ status_code: String(res.statusCode) });
        httpRequestsTotal.inc({ method: req.method, route, status_code: String(res.statusCode) });
        if (res.statusCode >= 500) {
            recordBackendError(route, res.statusCode, 'http_5xx');
        }
    });
    next();
});

const refreshHealthGauges = async () => {
    try {
        await pool.query('SELECT 1');
        dbHealthGauge.set(1);
    } catch (_e) {
        dbHealthGauge.set(0);
    }

    try {
        await web3.eth.net.isListening();
        blockchainHealthGauge.set(1);
        await updateBlockchainState();
    } catch (_e) {
        blockchainHealthGauge.set(0);
    }
};

setInterval(refreshHealthGauges, 10000);
refreshHealthGauges();

// --- 3. CONFIGURACIÓN DE RED Y CONTRATOS ---
const cargarContratoTruffle = (nombreJson) => {
    try {
        const artifact = require(`./build/contracts/${nombreJson}.json`);
        const preferredNetworkId = process.env.NETWORK_ID;
        const networkEntries = Object.entries(artifact.networks || {});
        const networkRecord = (preferredNetworkId && artifact.networks && artifact.networks[preferredNetworkId])
            || networkEntries[0]?.[1];
        const address = networkRecord?.address;
        if (!address || address === ZERO_ADDRESS || !isValidAddress(address)) {
            console.log(`Contrato ${nombreJson} sin dirección válida en artefacto.`);
            return null;
        }
        return new web3.eth.Contract(artifact.abi, address);
    } catch (error) {
        console.log(`Contrato ${nombreJson} no cargado aún.`);
        return null;
    }
};

const contract = cargarContratoTruffle('Notas');
const securityContract = cargarContratoTruffle('SecurityManager');
const auditContract = cargarContratoTruffle('AuditTrail');
const contractRegistry = [
    { name: 'Notas', instance: contract },
    { name: 'SecurityManager', instance: securityContract },
    { name: 'AuditTrail', instance: auditContract }
].filter((item) => item.instance?.options?.address && item.instance.options.address !== ZERO_ADDRESS)
    .map((item) => ({
        name: item.name,
        address: String(item.instance.options.address).toLowerCase(),
        abi: item.instance._jsonInterface || item.instance.options.jsonInterface || [],
        instance: item.instance
    }));

const ROLE_ID = {
    RECTOR: 1,
    TEACHER: 2,
    STUDENT: 3
};

const PERMISSIONS_BY_ROLE = {
    RECTOR: new Set([
        'grades:read:any',
        'reports:read',
        'reports:export',
        'analytics:read',
        'observability:read',
        'audit:read',
        'blockchain:read',
        'integrity:read',
        'security:role_change'
    ]),
    TEACHER: new Set([
        'grades:write',
        'grades:read:any',
        'courses:read:own',
        'attendance:read',
        'analytics:read',
        'blockchain:read'
    ]),
    STUDENT: new Set([
        'grades:read:own',
        'courses:read:own'
    ])
};

const DAY_MS = 24 * 60 * 60 * 1000;
const clampNumber = (value, min, max) => Math.min(Math.max(Number(value), min), max);
const roundNumber = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
const averageNumbers = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const stdDeviation = (values) => {
    if (values.length < 2) return 0;
    const mean = averageNumbers(values);
    const variance = values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / values.length;
    return Math.sqrt(variance);
};
const percentile = (sortedValues, pct) => {
    if (!sortedValues.length) return 0;
    const index = (sortedValues.length - 1) * (pct / 100);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedValues[lower];
    return sortedValues[lower] + ((sortedValues[upper] - sortedValues[lower]) * (index - lower));
};
const linearRegression = (points) => {
    if (points.length < 2) {
        return { slope: 0, intercept: points[0]?.y || 0, r2: 0 };
    }
    const n = points.length;
    const sumX = points.reduce((acc, point) => acc + point.x, 0);
    const sumY = points.reduce((acc, point) => acc + point.y, 0);
    const sumXY = points.reduce((acc, point) => acc + (point.x * point.y), 0);
    const sumX2 = points.reduce((acc, point) => acc + (point.x ** 2), 0);
    const denominator = (n * sumX2) - (sumX ** 2);
    const slope = denominator ? ((n * sumXY) - (sumX * sumY)) / denominator : 0;
    const intercept = n ? (sumY - (slope * sumX)) / n : 0;
    const meanY = sumY / n;
    const ssTot = points.reduce((acc, point) => acc + ((point.y - meanY) ** 2), 0);
    const ssRes = points.reduce((acc, point) => acc + ((point.y - (slope * point.x + intercept)) ** 2), 0);
    const r2 = ssTot ? Math.max(0, 1 - (ssRes / ssTot)) : 0;
    return { slope, intercept, r2 };
};
const groupRowsBy = (rows, keySelector) => {
    const groups = new Map();
    rows.forEach((row) => {
        const rawKey = String(keySelector(row) || '').trim();
        if (!rawKey) return;
        const key = rawKey.toLowerCase();
        if (!groups.has(key)) {
            groups.set(key, { key, displayName: rawKey, rows: [] });
        }
        groups.get(key).rows.push(row);
    });
    return groups;
};
const buildSeriesStats = (rows) => {
    const normalizedRows = rows
        .map((row) => ({
            grade: Number(row.grade),
            timestamp: row.timestamp ? new Date(row.timestamp).getTime() : null
        }))
        .filter((row) => Number.isFinite(row.grade) && Number.isFinite(row.timestamp));

    if (!normalizedRows.length) {
        return null;
    }

    const values = normalizedRows.map((row) => row.grade);
    const timestamps = normalizedRows.map((row) => row.timestamp).sort((a, b) => a - b);
    const firstTimestamp = timestamps[0];
    const pointSeries = normalizedRows.map((row) => ({
        x: (row.timestamp - firstTimestamp) / DAY_MS,
        y: row.grade
    }));
    const regression = linearRegression(pointSeries);
    const average = averageNumbers(values);
    const stdDev = stdDeviation(values);
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1 = percentile(sortedValues, 25);
    const q3 = percentile(sortedValues, 75);
    const iqr = q3 - q1;
    const lowerFence = q1 - (1.5 * iqr);
    const upperFence = q3 + (1.5 * iqr);
    const outliers = values.filter((value) => value < lowerFence || value > upperFence).length;
    const lastGrade = values[values.length - 1];
    const previousGrade = values.length > 1 ? values[values.length - 2] : lastGrade;
    const lastTimestamp = timestamps[timestamps.length - 1];
    const recencyDays = Math.max(0, (Date.now() - lastTimestamp) / DAY_MS);
    const lowGradeShare = values.filter((value) => value < 5).length / values.length;
    const abruptChange = Math.abs(lastGrade - previousGrade);

    return {
        samples: values.length,
        average: roundNumber(average, 2),
        stdDev: roundNumber(stdDev, 2),
        slopePerDay: roundNumber(regression.slope, 4),
        slopePerWeek: roundNumber(regression.slope * 7, 4),
        intercept: roundNumber(regression.intercept, 4),
        r2: roundNumber(regression.r2, 3),
        lastGrade: roundNumber(lastGrade, 2),
        previousGrade: roundNumber(previousGrade, 2),
        deltaFromPrevious: roundNumber(lastGrade - previousGrade, 2),
        recencyDays: roundNumber(recencyDays, 1),
        lowGradeShare: roundNumber(lowGradeShare, 3),
        q1: roundNumber(q1, 2),
        q3: roundNumber(q3, 2),
        iqr: roundNumber(iqr, 2),
        outliers,
        abruptChange: roundNumber(abruptChange, 2),
        firstTimestamp,
        lastTimestamp
    };
};
const scoreAbandonmentRisk = (stats) => {
    if (!stats) return 0;
    const meanPenalty = Math.max(0, 6.5 - stats.average) * 16;
    const trendPenalty = Math.max(0, -stats.slopePerWeek) * 40;
    const volatilityPenalty = Math.min(18, stats.stdDev * 4);
    const recencyPenalty = Math.min(15, stats.recencyDays * 0.4);
    const lowGradePenalty = Math.min(18, stats.lowGradeShare * 20);
    const samplePenalty = stats.samples < 3 ? 10 : stats.samples < 5 ? 4 : 0;
    const anomalyPenalty = Math.min(15, stats.outliers * 7);
    return clampNumber(meanPenalty + trendPenalty + volatilityPenalty + recencyPenalty + lowGradePenalty + samplePenalty + anomalyPenalty, 0, 100);
};
const scoreCourseHealth = (stats) => {
    if (!stats) return 0;
    const positiveMean = stats.average * 10;
    const trendPenalty = Math.max(0, -stats.slopePerWeek) * 35;
    const volatilityPenalty = Math.min(18, stats.stdDev * 3.5);
    const lowGradePenalty = Math.min(12, stats.lowGradeShare * 20);
    const anomalyPenalty = Math.min(12, stats.outliers * 6);
    const sampleBonus = Math.min(6, stats.samples * 0.5);
    return clampNumber(positiveMean - trendPenalty - volatilityPenalty - lowGradePenalty - anomalyPenalty + sampleBonus, 0, 100);
};
const scoreDecline = (stats) => {
    if (!stats) return 0;
    const slopePenalty = Math.max(0, -stats.slopePerWeek) * 100;
    const recentDropPenalty = Math.max(0, -stats.deltaFromPrevious) * 8;
    return clampNumber(slopePenalty + recentDropPenalty, 0, 100);
};
const scoreAnomaly = (stats) => {
    if (!stats) return 0;
    const zScore = stats.stdDev ? Math.abs(stats.lastGrade - stats.average) / stats.stdDev : 0;
    const deviationScore = Math.max(0, zScore - 1.5) * 25;
    const abruptScore = Math.max(0, stats.abruptChange - 1) * 8;
    const outlierScore = stats.outliers * 12;
    return clampNumber(deviationScore + abruptScore + outlierScore, 0, 100);
};
const buildAcademicIndicators = (rows) => {
    const studentGroups = groupRowsBy(rows, (row) => row.student_email);
    const courseGroups = groupRowsBy(rows, (row) => row.subject);

    const studentRiskRanking = Array.from(studentGroups.values())
        .map((group) => {
            const stats = buildSeriesStats(group.rows);
            if (!stats) return null;
            const riskScore = scoreAbandonmentRisk(stats);
            return {
                scope: 'student',
                entity: group.displayName,
                samples: stats.samples,
                average: stats.average,
                slopePerWeek: stats.slopePerWeek,
                stdDev: stats.stdDev,
                recencyDays: stats.recencyDays,
                lowGradeShare: stats.lowGradeShare,
                deltaFromPrevious: stats.deltaFromPrevious,
                riskScore,
                riskLevel: classifyRisk(riskScore),
                reason: riskScore >= 70
                    ? 'Media baja, pendiente negativa o baja cobertura de notas'
                    : riskScore >= 40
                        ? 'Señales moderadas de deterioro'
                        : 'Seguimiento estable'
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10);

    const courseHealthRanking = Array.from(courseGroups.values())
        .map((group) => {
            const stats = buildSeriesStats(group.rows);
            if (!stats) return null;
            const healthScore = scoreCourseHealth(stats);
            return {
                scope: 'course',
                entity: group.displayName,
                samples: stats.samples,
                average: stats.average,
                slopePerWeek: stats.slopePerWeek,
                stdDev: stats.stdDev,
                lowGradeShare: stats.lowGradeShare,
                outliers: stats.outliers,
                healthScore,
                healthLevel: healthScore >= 75 ? 'alta' : healthScore >= 50 ? 'media' : 'baja'
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, 10);

    const descendingTrendRanking = [
        ...Array.from(studentGroups.values())
            .map((group) => {
                const stats = buildSeriesStats(group.rows);
                if (!stats) return null;
                return {
                    scope: 'student',
                    entity: group.displayName,
                    samples: stats.samples,
                    average: stats.average,
                    slopePerWeek: stats.slopePerWeek,
                    trendScore: scoreDecline(stats),
                    deltaFromPrevious: stats.deltaFromPrevious,
                    recencyDays: stats.recencyDays
                };
            })
            .filter(Boolean),
        ...Array.from(courseGroups.values())
            .map((group) => {
                const stats = buildSeriesStats(group.rows);
                if (!stats) return null;
                return {
                    scope: 'course',
                    entity: group.displayName,
                    samples: stats.samples,
                    average: stats.average,
                    slopePerWeek: stats.slopePerWeek,
                    trendScore: scoreDecline(stats),
                    deltaFromPrevious: stats.deltaFromPrevious,
                    recencyDays: stats.recencyDays
                };
            })
            .filter(Boolean)
    ]
        .filter((item) => item.slopePerWeek < 0)
        .sort((a, b) => a.slopePerWeek - b.slopePerWeek)
        .slice(0, 10);

    const anomalies = [
        ...Array.from(studentGroups.values())
            .map((group) => {
                const stats = buildSeriesStats(group.rows);
                if (!stats) return null;
                return {
                    scope: 'student',
                    entity: group.displayName,
                    samples: stats.samples,
                    average: stats.average,
                    slopePerWeek: stats.slopePerWeek,
                    anomalyScore: scoreAnomaly(stats),
                    lastGrade: stats.lastGrade,
                    deltaFromPrevious: stats.deltaFromPrevious,
                    stdDev: stats.stdDev
                };
            })
            .filter(Boolean),
        ...Array.from(courseGroups.values())
            .map((group) => {
                const stats = buildSeriesStats(group.rows);
                if (!stats) return null;
                return {
                    scope: 'course',
                    entity: group.displayName,
                    samples: stats.samples,
                    average: stats.average,
                    slopePerWeek: stats.slopePerWeek,
                    anomalyScore: scoreAnomaly(stats),
                    lastGrade: stats.lastGrade,
                    deltaFromPrevious: stats.deltaFromPrevious,
                    stdDev: stats.stdDev
                };
            })
            .filter(Boolean)
    ]
        .filter((item) => item.anomalyScore >= 20)
        .sort((a, b) => b.anomalyScore - a.anomalyScore)
        .slice(0, 12);

    const formulas = {
        abandonmentRisk: 'risk = clamp(0,100, media baja + pendiente negativa + volatilidad + recencia + notas bajas + anomalías)',
        courseHealth: 'health = clamp(0,100, media*10 - pendiente negativa - volatilidad - notas bajas - anomalías + muestra)',
        descendingTrend: 'trend = ordenar por pendiente semanal negativa y descenso reciente',
        anomalies: 'anomaly = z-score del último dato + salto brusco + outliers IQR'
    };

    return {
        studentRiskRanking,
        courseHealthRanking,
        descendingTrendRanking,
        anomalies,
        formulas,
        summary: {
            studentsTracked: studentRiskRanking.length,
            coursesTracked: courseHealthRanking.length,
            anomalyCount: anomalies.length,
            generatedAt: new Date().toISOString()
        }
    };
};
const inferContractByAddress = (address) => {
    if (!address) return null;
    const match = contractRegistry.find((item) => item.address === String(address).toLowerCase());
    return match || null;
};
const decodeKnownLog = (log) => {
    if (!log?.address || !log?.topics?.length) return null;
    const contractMatch = inferContractByAddress(log.address);
    if (!contractMatch) return null;
    const eventAbi = (contractMatch.abi || []).find((item) => item.type === 'event' && web3.eth.abi.encodeEventSignature(item) === log.topics[0]);
    if (!eventAbi) return null;
    try {
        const decoded = web3.eth.abi.decodeLog(eventAbi.inputs || [], log.data || '0x', (log.topics || []).slice(1));
        return {
            contract: contractMatch.name,
            eventName: eventAbi.name,
            args: decoded
        };
    } catch (_error) {
        return {
            contract: contractMatch.name,
            eventName: eventAbi.name,
            args: null
        };
    }
};
const getContractOrigin = (tx) => {
    if (!tx?.to) return 'Contrato creado';
    const contractMatch = inferContractByAddress(tx.to);
    return contractMatch ? contractMatch.name : 'Externo';
};

// --- 4. MIDDLEWARES ---
const verifyToken = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header) return apiFail(res, 403, 'TOKEN_REQUIRED', 'Token requerido');
    const [scheme, token] = header.split(" ");
    if (scheme !== 'Bearer' || !token) {
        return apiFail(res, 401, 'TOKEN_FORMAT_INVALID', 'Formato de token inválido');
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return apiFail(res, 401, 'TOKEN_INVALID', 'Token inválido');
        req.user = decoded;
        next();
    });
};

const checkRole = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return apiFail(res, 403, 'FORBIDDEN', 'No autorizado');
    }
    next();
};

const checkPermission = (permission) => (req, res, next) => {
    const permissions = PERMISSIONS_BY_ROLE[req.user?.role];
    if (!permissions?.has(permission)) {
        return apiFail(res, 403, 'FORBIDDEN', 'Permiso insuficiente', { permission });
    }
    next();
};

const apiOk = (res, data, message = 'ok', extra = {}) => res.json({ success: true, message, data, ...extra });
const apiFail = (res, status, code, message, details = null) => {
    const finalCode = message ? code : 'REQUEST_FAILED';
    const finalMessage = message || code || 'Error';
    return res.status(status).json({
        success: false,
        error: {
            code: finalCode || 'REQUEST_FAILED',
            message: finalMessage,
            details,
            requestId: res.locals.requestId
        },
        message: finalMessage,
        ...(details && typeof details === 'object' ? details : {}),
        requestId: res.locals.requestId
    });
};

const validateBody = (schema) => (req, res, next) => {
    const errors = [];
    Object.entries(schema).forEach(([field, rules]) => {
        const value = req.body?.[field];
        if (rules.required && (value === undefined || value === null || String(value).trim() === '')) {
            errors.push(`${field} requerido`);
            return;
        }
        if (value === undefined || value === null || String(value).trim() === '') return;
        if (rules.type === 'number') {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) errors.push(`${field} debe ser numérico`);
            if (Number.isFinite(parsed) && rules.min !== undefined && parsed < rules.min) errors.push(`${field} mínimo ${rules.min}`);
            if (Number.isFinite(parsed) && rules.max !== undefined && parsed > rules.max) errors.push(`${field} máximo ${rules.max}`);
        }
        if (rules.type === 'string') {
            const text = String(value);
            if (rules.maxLength && text.length > rules.maxLength) errors.push(`${field} supera ${rules.maxLength} caracteres`);
            if (rules.enum && !rules.enum.includes(text)) errors.push(`${field} inválido`);
        }
    });
    if (errors.length) {
        return apiFail(res, 400, 'VALIDATION_ERROR', 'Entrada inválida', { errors });
    }
    next();
};
const classifyRisk = (score) => {
    if (score >= 70) return 'alto';
    if (score >= 40) return 'medio';
    return 'bajo';
};

const roleScopedLimiters = {
    RECTOR: createRateLimiter({ windowMs: 60 * 1000, max: Number(process.env.RECTOR_RATE_LIMIT_MAX || 20) }),
    TEACHER: createRateLimiter({ windowMs: 60 * 1000, max: Number(process.env.TEACHER_RATE_LIMIT_MAX || 60) }),
    STUDENT: createRateLimiter({ windowMs: 60 * 1000, max: Number(process.env.STUDENT_RATE_LIMIT_MAX || 120) })
};

const limitByRole = (req, res, next) => {
    const limiter = roleScopedLimiters[req.user?.role];
    if (limiter) return limiter(req, res, next);
    next();
};

const sendAuditEvent = async ({
    action,
    subject = '',
    outcome = 'SUCCESS',
    metadata = '',
    actor = '',
    role = '',
    severity = 'low',
    mitre = 'TA0000',
    requestId = '',
    dbId = null,
    txHash = null,
    blockNumber = null,
    gasUsed = null
}) => {
    auditEventsCounter.inc({ action, status: outcome, role: role || 'UNKNOWN' });
    const metadataObject = typeof metadata === 'string'
        ? (() => { try { return JSON.parse(metadata || '{}'); } catch (_e) { return { raw: metadata }; } })()
        : (metadata || {});
    emitStructuredLog({
        service: 'tfg_backend',
        action,
        subject,
        outcome,
        metadata: metadataObject,
        actor,
        role,
        severity,
        mitre,
        requestId,
        dbId,
        txHash,
        blockNumber,
        gasUsed
    });

    try {
        await pool.query(`
            INSERT INTO audit_events (
                request_id, event_type, actor, role, subject, status, severity, mitre,
                db_id, blockchain_hash, block_number, gas_used, metadata
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
        `, [
            requestId || null,
            sanitizeText(action).slice(0, 80),
            sanitizeIdentifier(actor).slice(0, 150) || null,
            sanitizeIdentifier(role).slice(0, 20) || null,
            sanitizeText(subject).slice(0, 180) || null,
            sanitizeText(outcome).slice(0, 32),
            sanitizeText(severity).slice(0, 20),
            sanitizeText(mitre).slice(0, 20),
            dbId,
            txHash,
            blockNumber,
            gasUsed,
            JSON.stringify(metadataObject)
        ]);
    } catch (error) {
        console.warn(`[WARN] audit_events insert failed: ${error.message}`);
    }

    if (!auditContract) return false;
    try {
        const accounts = await web3.eth.getAccounts();
        if (!accounts.length) return false;
        const chainMetadata = JSON.stringify({
            ...metadataObject,
            requestId,
            dbId,
            txHash,
            blockNumber,
            gasUsed
        });
        await auditContract.methods.recordAction(
            sanitizeText(action).slice(0, 64),
            sanitizeText(subject).slice(0, 128),
            sanitizeText(outcome).slice(0, 32),
            sanitizeText(chainMetadata).slice(0, 256)
        ).send({ from: accounts[0], gas: 350000 });
        return true;
    } catch (_error) {
        emitStructuredLog({
            service: 'tfg_backend',
            action: 'audit_contract_write_failed',
            subject: action,
            outcome: 'FAILED',
            requestId
        });
        return false;
    }
};

// --- 5. RUTAS API ---

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Autentica un usuario y devuelve un JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user, pass]
 *             properties:
 *               user:
 *                 type: string
 *               pass:
 *                 type: string
 *               mfa_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */
app.post('/api/login', loginRateLimit, validateBody({
    user: { type: 'string', required: true, maxLength: 150 },
    pass: { type: 'string', required: true, maxLength: 200 },
    mfa_code: { type: 'string', required: false, maxLength: 80 }
}), async (req, res) => {
    const user = sanitizeIdentifier(req.body?.user);
    const pass = String(req.body?.pass || '');
    const mfaCode = sanitizeIdentifier(req.body?.mfa_code || '');
    if (!user || !pass) {
        return apiFail(res, 400, 'VALIDATION_ERROR', 'Usuario y contraseña requeridos');
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [user]);
        const foundUser = result.rows[0];
        if (!foundUser) {
            recordSecurityIncident('LOGIN_FAILED', 2, '5.0', 'TA0001');
            loginFailureCounter.inc({ reason: 'not_found', role: 'UNKNOWN' });
            emitStructuredLog({ service: 'tfg_backend', action: 'login_failed', user, status: 'fail', severity: 'medium', mitre: 'TA0001', requestId: req.requestId });
            await sendAuditEvent({
                action: 'LOGIN_FAILED',
                subject: user,
                outcome: 'FAILED',
                metadata: { reason: 'not_found' },
                actor: user,
                role: 'UNKNOWN',
                severity: 'medium',
                mitre: 'TA0001',
                requestId: req.requestId
            });
            return apiFail(res, 401, 'INVALID_CREDENTIALS', 'Credenciales incorrectas');
        }

        const ok = await bcrypt.compare(pass, foundUser.password_hash);
        if (ok) {
            if (MFA_SHARED_CODE && isPrivilegedRole(foundUser.role) && mfaCode !== MFA_SHARED_CODE) {
                loginFailureCounter.inc({ reason: 'mfa', role: foundUser.role });
                recordSecurityIncident('MFA_REQUIRED', 2, '4.2', 'TA0006');
                emitStructuredLog({ service: 'tfg_backend', action: 'login_mfa_required', user, role: foundUser.role, status: 'fail', severity: 'medium', mitre: 'TA0006', requestId: req.requestId });
                await sendAuditEvent({
                    action: 'LOGIN_MFA_FAILED',
                    subject: foundUser.username,
                    outcome: 'FAILED',
                    metadata: { role: foundUser.role },
                    actor: foundUser.username,
                    role: foundUser.role,
                    severity: 'medium',
                    mitre: 'TA0006',
                    requestId: req.requestId
                });
                return apiFail(res, 401, 'MFA_REQUIRED', 'MFA requerido o inválido', { mfa_required: true });
            }
            const roleId = ROLE_ID[foundUser.role] || 0;
            const token = jwt.sign({
                id: foundUser.id,
                user: foundUser.username,
                role: foundUser.role,
                role_id: roleId,
                name: foundUser.full_name
            }, JWT_SECRET, { expiresIn: TOKEN_TTL });

            loginSuccessCounter.inc({ role: foundUser.role });
            await sendAuditEvent({
                action: 'LOGIN_SUCCESS',
                subject: foundUser.username,
                outcome: 'SUCCESS',
                metadata: { role: foundUser.role },
                actor: foundUser.username,
                role: foundUser.role,
                severity: 'low',
                mitre: 'TA0001',
                requestId: req.requestId
            });
            res.json({ success: true, token, role: foundUser.role, role_id: roleId, name: foundUser.full_name });
        } else {
            recordSecurityIncident('LOGIN_FAILED', 2, '5.0', 'TA0001');
            loginFailureCounter.inc({ reason: 'bad_password', role: foundUser.role });
            emitStructuredLog({ service: 'tfg_backend', action: 'login_failed', user, role: foundUser.role, status: 'fail', severity: 'medium', mitre: 'TA0001', requestId: req.requestId });
            await sendAuditEvent({
                action: 'LOGIN_FAILED',
                subject: foundUser.username,
                outcome: 'FAILED',
                metadata: { reason: 'bad_password', role: foundUser.role },
                actor: foundUser.username,
                role: foundUser.role,
                severity: 'medium',
                mitre: 'TA0001',
                requestId: req.requestId
            });
            apiFail(res, 401, 'INVALID_CREDENTIALS', "Credenciales incorrectas");
        }
    } catch (err) {
        recordSecurityIncident('LOGIN_ERROR', 3, '7.5', 'TA0006');
        loginFailureCounter.inc({ reason: 'error', role: 'UNKNOWN' });
        recordBackendError('/api/login', 500, 'login');
        apiFail(res, 500, 'LOGIN_ERROR', "Error interno en login");
    }
});

app.get('/api/my-students', verifyToken, checkPermission('courses:read:own'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id as course_id, c.course_name, u.full_name as student_name
            FROM courses c
            LEFT JOIN enrollments e ON c.id = e.course_id
            LEFT JOIN users u ON e.student_id = u.id
            WHERE c.teacher_id = $1
            ORDER BY c.id
        `, [req.user.id]);

        const formattedData = {};
        result.rows.forEach(row => {
            if (!formattedData[row.course_id]) {
                formattedData[row.course_id] = { courseName: row.course_name, students: [] };
            }
            if (row.student_name) {
                formattedData[row.course_id].students.push(row.student_name);
            }
        });
        apiOk(res, Object.values(formattedData));
    } catch (err) {
        apiFail(res, 500, "Error al consultar estudiantes");
    }
});

/**
 * @swagger
 * /api/subir-nota:
 *   post:
 *     summary: Registra una nueva calificación en la Blockchain
 *     tags: [Grades]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estudiante, asignatura, nota]
 *             properties:
 *               estudiante:
 *                 type: string
 *               asignatura:
 *                 type: string
 *               nota:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 10
 *     responses:
 *       200:
 *         description: Nota registrada exitosamente en la Blockchain
 *       403:
 *         description: Permisos insuficientes
 */
app.post('/api/subir-nota', writeRateLimit, verifyToken, checkPermission('grades:write'), limitByRole, validateBody({
    estudiante: { type: 'string', required: true, maxLength: 150 },
    asignatura: { type: 'string', required: true, maxLength: 120 },
    nota: { type: 'number', required: true, min: 0, max: 10 }
}), async (req, res) => {
    try {
        const estudiante = sanitizeIdentifier(req.body?.estudiante);
        const asignatura = sanitizeSubject(req.body?.asignatura);
        const notaNumerica = Number(req.body?.nota);
        if (!estudiante || !asignatura || Number.isNaN(notaNumerica)) {
            return apiFail(res, 400, 'VALIDATION_ERROR', "Datos incompletos o inválidos");
        }
        if (notaNumerica < 0 || notaNumerica > 10) {
            return apiFail(res, 400, 'VALIDATION_ERROR', "La nota debe estar entre 0 y 10");
        }

        const accounts = await web3.eth.getAccounts();
        if (!accounts.length) throw new Error("No hay cuentas disponibles en el nodo");

        if (!contract) throw new Error("Contrato Notas no desplegado");

        const receipt = await contract.methods.emitirCertificado(estudiante, asignatura, Math.round(notaNumerica))
            .send({ from: accounts[0], gas: 3000000 });

        const txHash = receipt.transactionHash;

        const queryDB = `
            INSERT INTO grades (student_email, subject, grade, blockchain_hash, request_id, block_number, gas_used, event_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'WRITE_GRADE')
            RETURNING id
        `;
        const inserted = await pool.query(queryDB, [estudiante, asignatura, notaNumerica, txHash, req.requestId, receipt.blockNumber, receipt.gasUsed]);
        const dbId = inserted.rows[0]?.id || null;

        notasCounter.inc();
        await sendAuditEvent({
            action: 'WRITE_GRADE',
            subject: `${estudiante}:${asignatura}`,
            outcome: 'SUCCESS',
            metadata: { grade: notaNumerica, txHash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed },
            actor: req.user.user,
            role: req.user.role,
            severity: 'low',
            mitre: 'TA0009',
            requestId: req.requestId,
            dbId,
            txHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed
        });
        emitStructuredLog({
            service: 'tfg_backend',
            action: 'write_grade_success',
            user: req.user.user,
            role: req.user.role,
            status: 'success',
            severity: 'low',
            mitre: 'TA0009',
            route: '/api/subir-nota',
            requestId: req.requestId,
            dbId,
            txHash
        });
        res.json({ success: true, txHash: txHash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, dbId });
    } catch (error) {
        recordSecurityIncident('WRITE_NOTE_ERROR', 3, '7.8', 'TA0006');
        recordBackendError('/api/subir-nota', 500, 'write_grade');
        emitStructuredLog({
            service: 'tfg_backend',
            action: 'write_grade_error',
            user: req.user?.user,
            role: req.user?.role,
            status: 'fail',
            severity: 'high',
            mitre: 'TA0006',
            route: '/api/subir-nota',
            error: error.message,
            requestId: req.requestId
        });
        await sendAuditEvent({
            action: 'WRITE_GRADE',
            subject: `${sanitizeIdentifier(req.body?.estudiante)}:${sanitizeSubject(req.body?.asignatura)}`,
            outcome: 'FAILED',
            metadata: { message: error.message },
            actor: req.user.user,
            role: req.user.role,
            severity: 'high',
            mitre: 'TA0006',
            requestId: req.requestId
        });
        apiFail(res, 500, 'WRITE_GRADE_ERROR', error.message);
    }
});

app.get('/api/consultar-notas', verifyToken, async (req, res, next) => {
    if (req.user.role === 'STUDENT') return checkPermission('grades:read:own')(req, res, next);
    return checkPermission('grades:read:any')(req, res, next);
}, async (req, res) => {
    try {
        if (req.user.role === 'STUDENT') {
            const query = `
                SELECT id, student_email, subject, grade, blockchain_hash, request_id, block_number, gas_used, timestamp
                FROM grades
                WHERE LOWER(TRIM(student_email)) = LOWER(TRIM($1))
                ORDER BY timestamp DESC
            `;
            const result = await pool.query(query, [req.user.user]);
            return res.json({ success: true, notas: result.rows });
        }

        const result = await pool.query(`
            SELECT id, student_email, subject, grade, blockchain_hash, request_id, block_number, gas_used, timestamp
            FROM grades
            ORDER BY timestamp DESC
        `);
        res.json({ success: true, notas: result.rows });
    } catch (err) {
        apiFail(res, 500, "Error al consultar notas");
    }
});

app.post('/api/analytics/predict', verifyToken, checkPermission('analytics:read'), limitByRole, validateBody({
    estudiante: { type: 'string', required: false, maxLength: 150 },
    asignatura: { type: 'string', required: false, maxLength: 120 },
    curso: { type: 'string', required: false, maxLength: 120 },
    scope: { type: 'string', required: false, maxLength: 30 },
    limit: { type: 'number', required: false, min: 5, max: 100 }
}), async (req, res) => {
    try {
        const estudiante = sanitizeIdentifier(req.body?.estudiante || req.query?.estudiante);
        const asignatura = sanitizeSubject(req.body?.asignatura || req.query?.asignatura);
        const curso = sanitizeSubject(req.body?.curso || req.query?.curso);
        const scope = sanitizeIdentifier(req.body?.scope || req.query?.scope || 'student');
        const requestedLimit = Number(req.body?.limit || req.query?.limit || 20);
        const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 20, 5), 100);
        const params = [];
        let sql = `
            SELECT student_email, subject, grade, timestamp
            FROM grades
        `;
        const where = [];
        if (scope === 'course' && curso) {
            where.push(`LOWER(TRIM(subject)) = LOWER(TRIM($${params.length + 1}))`);
            params.push(curso);
        }
        if (estudiante) {
            where.push(`LOWER(TRIM(student_email)) = LOWER(TRIM($${params.length + 1}))`);
            params.push(estudiante);
        }
        if (asignatura) {
            where.push(`LOWER(TRIM(subject)) = LOWER(TRIM($${params.length + 1}))`);
            params.push(asignatura);
        }
        if (where.length) {
            sql += ` WHERE ${where.join(' AND ')}`;
        }
        sql += ` ORDER BY timestamp ASC LIMIT ${limit}`;

        const result = await pool.query(sql, params);
        const rows = result.rows;

        if (!rows.length) {
            return apiOk(res, {
                samples: 0,
                slope: 0,
                intercept: 0,
                averageGrade: null,
                predictedGrade: null,
                riskScore: 50,
                riskLevel: 'medio',
                message: 'No hay suficientes muestras para predecir'
            });
        }

        const xs = rows.map((_, index) => index + 1);
        const ys = rows.map((row) => Number(row.grade));
        const n = xs.length;
        const sumX = xs.reduce((acc, value) => acc + value, 0);
        const sumY = ys.reduce((acc, value) => acc + value, 0);
        const sumXY = xs.reduce((acc, value, index) => acc + value * ys[index], 0);
        const sumX2 = xs.reduce((acc, value) => acc + (value * value), 0);
        const denominator = (n * sumX2) - (sumX * sumX) || 1;
        const slope = ((n * sumXY) - (sumX * sumY)) / denominator;
        const intercept = (sumY - (slope * sumX)) / n;
        const predictedGrade = Math.max(0, Math.min(10, (slope * (n + 1)) + intercept));
        const average = sumY / n;
        const trendPenalty = Math.max(0, (-slope) * 12);
        const lowPerformancePenalty = Math.max(0, (6 - average) * 10);
        const riskScore = Math.max(0, Math.min(100, Math.round((50 - (predictedGrade * 4)) + trendPenalty + lowPerformancePenalty)));
        emitStructuredLog({
            service: 'tfg_backend',
            action: 'predict_success',
            user: req.user.user,
            role: req.user.role,
            status: 'success',
            severity: 'low',
            mitre: 'TA0008',
            route: '/api/analytics/predict',
            requestId: req.requestId
        });

        apiOk(res, {
            samples: n,
            slope,
            intercept,
            averageGrade: Number(average.toFixed(2)),
            predictedGrade: Number(predictedGrade.toFixed(2)),
            riskScore,
            riskLevel: classifyRisk(riskScore),
            student: estudiante || null,
            subject: asignatura || null,
            course: curso || null,
            scope
        });
    } catch (err) {
        recordSecurityIncident('PREDICT_ERROR', 2, '4.3', 'TA0008');
        recordBackendError('/api/analytics/predict', 500, 'analytics');
        emitStructuredLog({
            service: 'tfg_backend',
            action: 'predict_error',
            user: req.user?.user,
            role: req.user?.role,
            status: 'fail',
            severity: 'high',
            mitre: 'TA0008',
            route: '/api/analytics/predict',
            error: err.message,
            requestId: req.requestId
        });
        apiFail(res, 500, 'PREDICT_ERROR', 'Error al generar predicción');
    }
});

app.get('/api/analytics/insights', verifyToken, checkPermission('analytics:read'), limitByRole, async (req, res) => {
    try {
        const scope = sanitizeIdentifier(req.query?.scope || 'course');
        const course = sanitizeSubject(req.query?.curso || '');
        const rows = await pool.query(`
            SELECT student_email, subject, grade, timestamp
            FROM grades
            ${course ? 'WHERE LOWER(TRIM(subject)) = LOWER(TRIM($1))' : ''}
            ORDER BY timestamp ASC
        `, course ? [course] : []);
        const academic = buildAcademicIndicators(rows.rows);
        const evolution = await pool.query(`
            SELECT date_trunc('day', timestamp) AS day,
                   ROUND(AVG(grade)::numeric, 2) AS average_grade,
                   COUNT(*)::int AS samples
            FROM grades
            ${course ? 'WHERE LOWER(TRIM(subject)) = LOWER(TRIM($1))' : ''}
            GROUP BY date_trunc('day', timestamp)
            ORDER BY day ASC
        `, course ? [course] : []);

        apiOk(res, {
            scope,
            course: course || null,
            ...academic,
            evolution: evolution.rows.map((row) => ({
                day: row.day,
                averageGrade: Number(row.average_grade),
                samples: row.samples
            })),
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        recordBackendError('/api/analytics/insights', 500, 'analytics');
        apiFail(res, 500, 'ANALYTICS_INSIGHTS_ERROR', 'No fue posible generar insights');
    }
});

app.get('/api/status', async (_req, res) => {
    const [dbOk, blockchainOk, blockNumber] = await Promise.all([
        pool.query('SELECT 1').then(() => true).catch(() => false),
        web3.eth.net.isListening().then(() => true).catch(() => false),
        web3.eth.getBlockNumber().catch(() => null)
    ]);

    const latestBlock = typeof blockNumber === 'number'
        ? await web3.eth.getBlock(blockNumber).catch(() => null)
        : null;

    res.json({
        success: true,
        data: {
            uptimeSeconds: Math.round(process.uptime()),
            db: dbOk,
            blockchain: blockchainOk,
            blockHeight: lastObservedBlockNumber,
            blockAgeSeconds: lastObservedBlockTimestamp ? Math.max(0, Math.floor(Date.now() / 1000) - lastObservedBlockTimestamp) : 0,
            latestBlock: latestBlock ? {
                number: latestBlock.number,
                hash: latestBlock.hash,
                gasUsed: latestBlock.gasUsed,
                txCount: latestBlock.transactions ? latestBlock.transactions.length : 0
            } : null,
            contractsLoaded: {
                notas: !!contract,
                security: !!securityContract,
                audit: !!auditContract
            }
        }
    });
});

app.get('/api/blockchain/explorer', async (req, res) => {
    try {
        const latestBlockNumber = await web3.eth.getBlockNumber();
        const requestedLimit = parseBoundedInt(req.query?.limit, 6, 1, 12);
        const blockFilter = req.query?.block !== undefined ? parseBoundedInt(req.query.block, null, 0, latestBlockNumber) : null;
        const hashFilter = sanitizeIdentifier(req.query?.hash || '').toLowerCase();
        const addressFilter = sanitizeIdentifier(req.query?.address || '').toLowerCase();
        const eventTypeFilter = sanitizeIdentifier(req.query?.event_type || '');
        const requestIdFilter = sanitizeIdentifier(req.query?.request_id || '');
        const actorFilter = sanitizeIdentifier(req.query?.actor || '');
        const minGas = req.query?.minGas !== undefined ? parseBoundedInt(req.query.minGas, 0, 0, Number.MAX_SAFE_INTEGER) : 0;
        const focusedSearch = Boolean(blockFilter !== null || hashFilter || addressFilter || eventTypeFilter || requestIdFilter || actorFilter);
        const traceLimit = focusedSearch ? Math.max(12, requestedLimit * 4) : Math.max(24, requestedLimit * 4);

        const addClause = (where, params, clause, value) => {
            params.push(value);
            where.push(clause.replace(':n', String(params.length)));
        };

        const gradeWhere = [];
        const gradeParams = [];
        if (requestIdFilter) addClause(gradeWhere, gradeParams, 'request_id = $:n', requestIdFilter);
        if (blockFilter !== null) addClause(gradeWhere, gradeParams, 'block_number = $:n', blockFilter);
        if (hashFilter && isValidTxHash(hashFilter)) addClause(gradeWhere, gradeParams, 'LOWER(blockchain_hash) = LOWER($:n)', hashFilter);
        if (eventTypeFilter) addClause(gradeWhere, gradeParams, 'event_type = $:n', eventTypeFilter);
        gradeParams.push(traceLimit);

        const auditWhere = [];
        const auditParams = [];
        if (requestIdFilter) addClause(auditWhere, auditParams, 'request_id = $:n', requestIdFilter);
        if (blockFilter !== null) addClause(auditWhere, auditParams, 'block_number = $:n', blockFilter);
        if (hashFilter && isValidTxHash(hashFilter)) addClause(auditWhere, auditParams, 'LOWER(blockchain_hash) = LOWER($:n)', hashFilter);
        if (eventTypeFilter) addClause(auditWhere, auditParams, 'event_type = $:n', eventTypeFilter);
        if (actorFilter) addClause(auditWhere, auditParams, 'LOWER(actor) LIKE $:n', `%${actorFilter.toLowerCase()}%`);
        auditParams.push(traceLimit);

        const gradeRows = await pool.query(`
            SELECT id, student_email, subject, grade, blockchain_hash, request_id, block_number, gas_used, event_type, timestamp
            FROM grades
            ${gradeWhere.length ? `WHERE ${gradeWhere.join(' AND ')}` : ''}
            ORDER BY timestamp DESC
            LIMIT $${gradeParams.length}
        `, gradeParams);

        const auditRows = await pool.query(`
            SELECT id, request_id, event_type, actor, role, subject, status, severity, mitre,
                   db_id, blockchain_hash, block_number, gas_used, metadata, created_at
            FROM audit_events
            ${auditWhere.length ? `WHERE ${auditWhere.join(' AND ')}` : ''}
            ORDER BY created_at DESC
            LIMIT $${auditParams.length}
        `, auditParams);

        const recentBlockNumbers = (() => {
            if (blockFilter !== null) return [blockFilter];
            const matchedNumbers = [
                ...gradeRows.rows.map((row) => Number(row.block_number)).filter((value) => Number.isFinite(value)),
                ...auditRows.rows.map((row) => Number(row.block_number)).filter((value) => Number.isFinite(value))
            ];
            const uniqueMatched = [...new Set(matchedNumbers)].sort((a, b) => b - a);
            if (uniqueMatched.length) return uniqueMatched.slice(0, requestedLimit);
            return Array.from({ length: requestedLimit }, (_value, index) => latestBlockNumber - index).filter((value) => value >= 0);
        })();

        const blocks = [];
        for (const blockNumber of recentBlockNumbers) {
            const block = await web3.eth.getBlock(blockNumber, true);
            if (!block) continue;
            const transactions = (block.transactions || []).slice(0, 15).map((tx) => ({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                gas: tx.gas,
                gasPrice: tx.gasPrice,
                value: tx.value,
                nonce: tx.nonce
            }));
            blocks.push({
                number: block.number,
                hash: block.hash,
                parentHash: block.parentHash,
                gasUsed: block.gasUsed,
                gasLimit: block.gasLimit,
                timestamp: Number(block.timestamp),
                timestampIso: new Date(Number(block.timestamp) * 1000).toISOString(),
                transactions
            });
        }

        const blockTransactions = blocks.flatMap((block) => block.transactions.map((tx) => ({
            ...tx,
            blockNumber: block.number,
            blockHash: block.hash,
            blockTimestamp: block.timestamp,
            blockTimestampIso: block.timestampIso
        })));

        const receiptEntries = await Promise.all(blockTransactions.map(async (tx) => {
            const receipt = await web3.eth.getTransactionReceipt(tx.hash).catch(() => null);
            return [tx.hash, receipt];
        }));
        const receiptByHash = new Map(receiptEntries);
        const txByHash = new Map(blockTransactions.map((tx) => [tx.hash.toLowerCase(), tx]));

        const chainEntries = blockTransactions.map((tx) => {
            const receipt = receiptByHash.get(tx.hash) || null;
            const decodedLog = receipt?.logs?.map((log) => decodeKnownLog(log)).find(Boolean) || null;
            const inferredContract = decodedLog?.contract || getContractOrigin(tx);
            return {
                source: 'chain',
                entityType: 'transaction',
                txHash: tx.hash,
                blockHash: tx.blockHash,
                blockNumber: tx.blockNumber,
                timestamp: tx.blockTimestampIso,
                blockTimestamp: tx.blockTimestamp,
                from: tx.from,
                to: tx.to,
                gasUsed: receipt?.gasUsed !== undefined ? Number(receipt.gasUsed) : Number(tx.gas || 0),
                gasLimit: tx.gas,
                gasPrice: tx.gasPrice,
                value: tx.value,
                nonce: tx.nonce,
                contractName: inferredContract,
                originContract: inferredContract,
                eventType: decodedLog?.eventName || 'TX',
                eventName: decodedLog?.eventName || null,
                dbTable: null,
                dbId: null,
                dbRelation: null,
                requestId: null,
                status: receipt?.status ? 'CHAIN_MATCH' : 'CHAIN_ONLY',
                summary: decodedLog?.eventName ? `${inferredContract} · ${decodedLog.eventName}` : `${inferredContract} · tx`
            };
        });

        const entriesByHash = new Map();
        const addEntry = (entry) => {
            const key = (entry.txHash || `db:${entry.dbTable}:${entry.dbId}`).toLowerCase();
            const current = entriesByHash.get(key);
            entriesByHash.set(key, current ? { ...current, ...entry } : entry);
        };

        gradeRows.rows.forEach((row) => {
            const tx = row.blockchain_hash ? txByHash.get(String(row.blockchain_hash).toLowerCase()) : null;
            const receipt = row.blockchain_hash ? receiptByHash.get(row.blockchain_hash) : null;
            const decodedLog = receipt?.logs?.map((log) => decodeKnownLog(log)).find(Boolean) || null;
            const gasUsed = Number(row.gas_used || receipt?.gasUsed || tx?.gas || 0) || null;
            addEntry({
                source: 'db',
                entityType: 'grade',
                txHash: row.blockchain_hash || null,
                blockHash: tx?.blockHash || null,
                blockNumber: Number(row.block_number || tx?.blockNumber || 0) || null,
                timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : tx?.blockTimestampIso || null,
                blockTimestamp: tx?.blockTimestamp || null,
                from: tx?.from || null,
                to: tx?.to || null,
                gasUsed,
                gasLimit: tx?.gas || null,
                gasPrice: tx?.gasPrice || null,
                value: tx?.value || null,
                nonce: tx?.nonce || null,
                contractName: decodedLog?.contract || 'Notas',
                originContract: 'Notas',
                eventType: row.event_type || decodedLog?.eventName || 'WRITE_GRADE',
                eventName: decodedLog?.eventName || 'CertificadoEmitido',
                dbTable: 'grades',
                dbId: row.id,
                dbRelation: `grades#${row.id}`,
                requestId: row.request_id || null,
                studentEmail: row.student_email,
                subject: row.subject,
                grade: Number(row.grade),
                status: tx ? 'CHAIN_MATCH' : 'DB_ONLY',
                summary: `${row.student_email} · ${row.subject} · ${Number(row.grade).toFixed(2)}`
            });
        });

        auditRows.rows.forEach((row) => {
            const tx = row.blockchain_hash ? txByHash.get(String(row.blockchain_hash).toLowerCase()) : null;
            const receipt = row.blockchain_hash ? receiptByHash.get(row.blockchain_hash) : null;
            const decodedLog = receipt?.logs?.map((log) => decodeKnownLog(log)).find(Boolean) || null;
            const gasUsed = Number(row.gas_used || receipt?.gasUsed || tx?.gas || 0) || null;
            addEntry({
                source: 'db',
                entityType: 'audit',
                txHash: row.blockchain_hash || null,
                blockHash: tx?.blockHash || null,
                blockNumber: Number(row.block_number || tx?.blockNumber || 0) || null,
                timestamp: row.created_at ? new Date(row.created_at).toISOString() : tx?.blockTimestampIso || null,
                blockTimestamp: tx?.blockTimestamp || null,
                from: tx?.from || null,
                to: tx?.to || null,
                gasUsed,
                gasLimit: tx?.gas || null,
                gasPrice: tx?.gasPrice || null,
                value: tx?.value || null,
                nonce: tx?.nonce || null,
                contractName: decodedLog?.contract || 'AuditTrail',
                originContract: 'AuditTrail',
                eventType: row.event_type,
                eventName: decodedLog?.eventName || 'ActionRecorded',
                dbTable: 'audit_events',
                dbId: row.id,
                dbRelation: `audit_events#${row.id}`,
                requestId: row.request_id || null,
                actor: row.actor,
                role: row.role,
                subject: row.subject,
                status: row.status,
                severity: row.severity,
                mitre: row.mitre,
                metadata: row.metadata,
                summary: `${row.event_type} · ${row.actor || row.subject || 'n/a'}`
            });
        });

        chainEntries.forEach((entry) => {
            if (!focusedSearch || entry.entityType === 'transaction') {
                const key = (entry.txHash || '').toLowerCase();
                if (!entriesByHash.has(key)) {
                    addEntry(entry);
                }
            }
        });

        const entries = Array.from(entriesByHash.values())
            .filter((entry) => {
                if (blockFilter !== null && Number(entry.blockNumber) !== Number(blockFilter)) {
                    return false;
                }
                if (requestIdFilter && String(entry.requestId || '').toLowerCase() !== requestIdFilter.toLowerCase()) {
                    return false;
                }
                if (eventTypeFilter && String(entry.eventType || '').toLowerCase() !== eventTypeFilter.toLowerCase()) {
                    return false;
                }
                if (actorFilter && !String(entry.actor || '').toLowerCase().includes(actorFilter.toLowerCase())) {
                    return false;
                }
                if (hashFilter) {
                    const txMatch = String(entry.txHash || '').toLowerCase().includes(hashFilter);
                    const blockMatch = String(entry.blockHash || '').toLowerCase().includes(hashFilter);
                    if (!txMatch && !blockMatch) {
                        return false;
                    }
                }
                if (addressFilter) {
                    const matchesAddress = [
                        entry.from,
                        entry.to,
                        entry.originContract,
                        entry.contractName
                    ].some((value) => String(value || '').toLowerCase().includes(addressFilter));
                    if (!matchesAddress) {
                        return false;
                    }
                }
                if (minGas) {
                    const gasValue = Number(entry.gasUsed || entry.gasLimit || 0);
                    if (gasValue < minGas) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const tsA = new Date(a.timestamp || 0).getTime();
                const tsB = new Date(b.timestamp || 0).getTime();
                return tsB - tsA;
            });

        const auditEvents = auditRows.rows.map((row) => ({
            id: row.id,
            request_id: row.request_id,
            event_type: row.event_type,
            actor: row.actor,
            role: row.role,
            subject: row.subject,
            status: row.status,
            severity: row.severity,
            mitre: row.mitre,
            db_id: row.db_id,
            blockchain_hash: row.blockchain_hash,
            block_number: row.block_number,
            gas_used: row.gas_used,
            created_at: row.created_at
        }));

        res.json({
            success: true,
            data: {
                latestBlockNumber,
                filters: {
                    block: blockFilter,
                    hash: hashFilter,
                    address: addressFilter,
                    eventType: eventTypeFilter,
                    requestId: requestIdFilter,
                    actor: actorFilter,
                    minGas
                },
                contracts: contractRegistry.map((item) => ({
                    name: item.name,
                    address: item.address,
                    loaded: true
                })),
                blocks,
                entries,
                auditEvents,
                summary: {
                    blockCount: blocks.length,
                    entryCount: entries.length,
                    dbGrades: gradeRows.rows.length,
                    dbAudits: auditRows.rows.length
                }
            }
        });
    } catch (err) {
        apiFail(res, 500, 'BLOCKCHAIN_EXPLORER_ERROR', 'No fue posible consultar el explorador blockchain');
    }
});

app.get('/api/blockchain/integrity', verifyToken, checkPermission('integrity:read'), limitByRole, async (req, res) => {
    try {
        const limit = parseBoundedInt(req.query?.limit, 50, 1, 200);
        const grades = (await pool.query(`
            SELECT id, student_email, subject, grade, blockchain_hash, request_id, block_number, gas_used, timestamp
            FROM grades
            ORDER BY timestamp DESC
            LIMIT $1
        `, [limit])).rows;

        const checks = await Promise.all(grades.map(async (grade) => {
            const txHashValid = isValidTxHash(grade.blockchain_hash);
            const receipt = txHashValid
                ? await web3.eth.getTransactionReceipt(grade.blockchain_hash).catch(() => null)
                : null;
            const blockMatches = !grade.block_number || !receipt?.blockNumber || Number(grade.block_number) === Number(receipt.blockNumber);
            return {
                dbId: grade.id,
                requestId: grade.request_id,
                studentEmail: grade.student_email,
                subject: grade.subject,
                blockchainHash: grade.blockchain_hash,
                dbBlockNumber: grade.block_number,
                chainBlockNumber: receipt?.blockNumber || null,
                gasUsed: receipt?.gasUsed || grade.gas_used || null,
                status: txHashValid && receipt && blockMatches ? 'OK' : 'DISCREPANCY',
                issues: [
                    ...(!txHashValid ? ['INVALID_TX_HASH'] : []),
                    ...(txHashValid && !receipt ? ['TX_NOT_FOUND'] : []),
                    ...(!blockMatches ? ['BLOCK_NUMBER_MISMATCH'] : [])
                ]
            };
        }));

        const discrepancies = checks.filter((item) => item.status !== 'OK');
        apiOk(res, {
            checked: checks.length,
            ok: checks.length - discrepancies.length,
            discrepancies: discrepancies.length,
            items: checks,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        recordBackendError('/api/blockchain/integrity', 500, 'integrity');
        apiFail(res, 500, 'INTEGRITY_CHECK_ERROR', 'No fue posible verificar integridad DB-blockchain');
    }
});

app.get('/api/audit/events', verifyToken, checkPermission('audit:read'), limitByRole, async (req, res) => {
    try {
        const limit = parseBoundedInt(req.query?.limit, 50, 1, 200);
        const params = [];
        const where = [];
        const requestId = sanitizeIdentifier(req.query?.request_id || '');
        const eventType = sanitizeIdentifier(req.query?.event_type || '');
        const actor = sanitizeIdentifier(req.query?.actor || '');
        const hash = sanitizeIdentifier(req.query?.hash || '');
        if (requestId) {
            params.push(requestId);
            where.push(`request_id = $${params.length}`);
        }
        if (eventType) {
            params.push(eventType);
            where.push(`event_type = $${params.length}`);
        }
        if (actor) {
            params.push(`%${actor.toLowerCase()}%`);
            where.push(`LOWER(actor) LIKE $${params.length}`);
        }
        if (hash) {
            params.push(hash);
            where.push(`LOWER(blockchain_hash) = LOWER($${params.length})`);
        }
        params.push(limit);
        const result = await pool.query(`
            SELECT id, request_id, event_type, actor, role, subject, status, severity, mitre,
                   db_id, blockchain_hash, block_number, gas_used, metadata, created_at
            FROM audit_events
            ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY created_at DESC
            LIMIT $${params.length}
        `, params);
        apiOk(res, result.rows);
    } catch (error) {
        recordBackendError('/api/audit/events', 500, 'audit');
        apiFail(res, 500, 'AUDIT_EVENTS_ERROR', 'No fue posible consultar auditoría');
    }
});

app.get('/api/analytics/trends', verifyToken, checkPermission('analytics:read'), limitByRole, async (req, res) => {
    try {
        const subject = sanitizeSubject(req.query?.subject || '');
        const params = [];
        const where = [];
        if (subject) {
            params.push(subject);
            where.push(`LOWER(TRIM(subject)) = LOWER(TRIM($${params.length}))`);
        }
        const result = await pool.query(`
            SELECT subject,
                   date_trunc('day', timestamp) AS day,
                   ROUND(AVG(grade)::numeric, 2) AS average_grade,
                   COUNT(*)::int AS samples
            FROM grades
            ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            GROUP BY subject, date_trunc('day', timestamp)
            ORDER BY day ASC, subject ASC
        `, params);
        apiOk(res, {
            subject: subject || null,
            series: result.rows,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        recordBackendError('/api/analytics/trends', 500, 'analytics');
        apiFail(res, 500, 'TRENDS_ERROR', 'No fue posible consultar tendencias');
    }
});

app.get('/api/mis-cursos', verifyToken, checkRole(['TEACHER', 'RECTOR', 'STUDENT']), async (req, res) => {
    try {
        if (req.user.role === 'TEACHER') {
            const result = await pool.query(`
                SELECT c.id, c.course_name, COUNT(e.student_id) AS total_students
                FROM courses c
                LEFT JOIN enrollments e ON e.course_id = c.id
                WHERE c.teacher_id = $1
                GROUP BY c.id, c.course_name
                ORDER BY c.course_name
            `, [req.user.id]);
            return apiOk(res, result.rows);
        }

        if (req.user.role === 'STUDENT') {
            const result = await pool.query(`
                SELECT c.id, c.course_name, u.full_name AS teacher_name
                FROM enrollments e
                JOIN courses c ON c.id = e.course_id
                LEFT JOIN users u ON u.id = c.teacher_id
                WHERE e.student_id = $1
                ORDER BY c.course_name
            `, [req.user.id]);
            return apiOk(res, result.rows);
        }

        const result = await pool.query(`
            SELECT c.id, c.course_name, u.full_name AS teacher_name, COUNT(e.student_id) AS total_students
            FROM courses c
            LEFT JOIN users u ON u.id = c.teacher_id
            LEFT JOIN enrollments e ON e.course_id = c.id
            GROUP BY c.id, c.course_name, u.full_name
            ORDER BY c.course_name
        `);
        return apiOk(res, result.rows);
    } catch (err) {
        apiFail(res, 500, "Error al consultar cursos");
    }
});

const verifySecurityAdmin = (req, res, next) => {
    const header = req.headers['authorization'];
    if (header) {
        return verifyToken(req, res, () => checkPermission('security:role_change')(req, res, next));
    }
    if (!SECURITY_ADMIN_TOKEN) {
        return apiFail(res, 403, 'SECURITY_ROUTE_DISABLED', 'Ruta deshabilitada');
    }
    if (req.headers['x-security-token'] !== SECURITY_ADMIN_TOKEN) {
        return apiFail(res, 401, 'SECURITY_TOKEN_INVALID', 'Token de seguridad inválido');
    }
    req.user = { user: 'security-admin', role: 'RECTOR' };
    next();
};

app.post('/api/security/role-change', verifySecurityAdmin, validateBody({
    username: { type: 'string', required: true, maxLength: 150 },
    role: { type: 'string', required: true, enum: ['RECTOR', 'TEACHER', 'STUDENT'] },
    full_name: { type: 'string', required: false, maxLength: 100 },
    action: { type: 'string', required: false, maxLength: 40 }
}), async (req, res) => {

    const username = sanitizeIdentifier(req.body?.username);
    const role = sanitizeIdentifier(req.body?.role);
    const fullName = sanitizeName(req.body?.full_name || '');
    const action = sanitizeIdentifier(req.body?.action || 'update');

    if (!username || !role || !['RECTOR', 'TEACHER', 'STUDENT'].includes(role)) {
        return apiFail(res, 400, 'VALIDATION_ERROR', 'Datos inválidos');
    }

    try {
        const result = await pool.query('SELECT id, username, role, full_name FROM users WHERE username = $1', [username]);
        if (!result.rows.length) {
            return apiFail(res, 404, 'USER_NOT_FOUND', 'Usuario no encontrado');
        }

        await pool.query(
            'UPDATE users SET role = $2, full_name = COALESCE(NULLIF($3, \'\'), full_name) WHERE username = $1',
            [username, role, fullName]
        );

        await sendAuditEvent({
            action: `ROLE_${action.toUpperCase()}`,
            subject: username,
            outcome: 'SUCCESS',
            metadata: { oldRole: result.rows[0].role, newRole: role, fullName: fullName || result.rows[0].full_name },
            actor: req.user.user,
            role: req.user.role,
            severity: 'medium',
            mitre: 'TA0004',
            requestId: req.requestId
        });

        res.json({ success: true, message: 'Rol actualizado' });
    } catch (error) {
        recordBackendError('/api/security/role-change', 500, 'security');
        await sendAuditEvent({
            action: `ROLE_${action.toUpperCase()}`,
            subject: username,
            outcome: 'FAILED',
            metadata: { message: error.message },
            actor: req.user.user,
            role: req.user.role,
            severity: 'high',
            mitre: 'TA0004',
            requestId: req.requestId
        });
        apiFail(res, 500, 'ROLE_CHANGE_ERROR', 'No fue posible actualizar el rol');
    }
});

app.get('/api/pasar-asistencia', verifyToken, checkPermission('attendance:read'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id AS course_id, c.course_name, u.full_name AS student_name
            FROM courses c
            LEFT JOIN enrollments e ON e.course_id = c.id
            LEFT JOIN users u ON u.id = e.student_id
            WHERE c.teacher_id = $1
            ORDER BY c.course_name, u.full_name
        `, [req.user.id]);

        const grouped = {};
        result.rows.forEach((row) => {
            if (!grouped[row.course_id]) {
                grouped[row.course_id] = { courseId: row.course_id, courseName: row.course_name, students: [] };
            }
            if (row.student_name) grouped[row.course_id].students.push(row.student_name);
        });
        apiOk(res, Object.values(grouped));
    } catch (err) {
        apiFail(res, 500, "Error al cargar asistencia");
    }
});

app.get('/api/rector/informes', verifyToken, checkPermission('reports:read'), limitByRole, async (req, res) => {
    try {
        const [usersByRole, gradeDistribution, coursesSummary, latestGrades, auditSummary] = await Promise.all([
            pool.query(`
                SELECT role, COUNT(*)::int AS total
                FROM users
                GROUP BY role
                ORDER BY role
            `),
            pool.query(`
                SELECT FLOOR(grade)::int AS bucket, COUNT(*)::int AS total
                FROM grades
                GROUP BY FLOOR(grade)::int
                ORDER BY bucket
            `),
            pool.query(`
                SELECT c.course_name, COUNT(e.student_id)::int AS total_students
                FROM courses c
                LEFT JOIN enrollments e ON e.course_id = c.id
                GROUP BY c.id, c.course_name
                ORDER BY c.course_name
            `),
            pool.query(`
                SELECT student_email, subject, grade, blockchain_hash, request_id, block_number, gas_used, timestamp
                FROM grades
                ORDER BY timestamp DESC
                LIMIT 20
            `),
            pool.query(`
                SELECT event_type, status, severity, COUNT(*)::int AS total
                FROM audit_events
                WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
                GROUP BY event_type, status, severity
                ORDER BY total DESC, event_type
            `, [REPORT_WINDOW_DAYS])
        ]);

        apiOk(res, {
            roleBreakdown: usersByRole.rows,
            gradeDistribution: gradeDistribution.rows,
            courses: coursesSummary.rows,
            latestGrades: latestGrades.rows,
            auditSummary: auditSummary.rows
        });
        await sendAuditEvent({
            action: 'RECTOR_REPORT_VIEW',
            subject: 'informes',
            outcome: 'SUCCESS',
            metadata: { windowDays: REPORT_WINDOW_DAYS },
            actor: req.user.user,
            role: req.user.role,
            severity: 'low',
            mitre: 'TA0007',
            requestId: req.requestId
        });
    } catch (err) {
        recordBackendError('/api/rector/informes', 500, 'report');
        apiFail(res, 500, "Error al generar informe rectoral");
    }
});

app.post('/api/rector/report-export', verifyToken, checkPermission('reports:export'), limitByRole, validateBody({
    format: { type: 'string', required: false, enum: ['pdf', 'json'] }
}), async (req, res) => {
    try {
        reportExportCounter.inc();
        await sendAuditEvent({
            action: 'RECTOR_REPORT_EXPORT',
            subject: 'pdf',
            outcome: 'SUCCESS',
            metadata: { format: sanitizeIdentifier(req.body?.format || 'pdf') },
            actor: req.user.user,
            role: req.user.role,
            severity: 'low',
            mitre: 'TA0010',
            requestId: req.requestId
        });
        res.json({ success: true, message: 'Export audit recorded' });
    } catch (error) {
        recordBackendError('/api/rector/report-export', 500, 'report');
        apiFail(res, 500, 'No fue posible registrar la exportación');
    }
});

const exposeMetrics = async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};

app.get('/metrics', exposeMetrics);
app.get('/api/metrics', exposeMetrics);

app.get('/api/health-check', async (req, res) => {
    let dbOk = false;
    let blockchainOk = false;
    try {
        await pool.query('SELECT 1');
        dbOk = true;
    } catch (_e) {}

    try {
        await web3.eth.net.isListening();
        blockchainOk = true;
    } catch (_e) {}

    res.status(dbOk && blockchainOk ? 200 : 503).json({
        status: dbOk && blockchainOk ? "online" : "degraded",
        db: dbOk,
        blockchain: blockchainOk,
        blockHeight: lastObservedBlockNumber,
        blockAgeSeconds: lastObservedBlockTimestamp ? Math.max(0, Math.floor(Date.now() / 1000) - lastObservedBlockTimestamp) : 0,
        contractsLoaded: {
            notas: !!contract,
            security: !!securityContract,
            audit: !!auditContract
        }
    });
});

// NeuralSOC Circuit Breaker Endpoint
app.post('/api/admin/circuit-breaker', (req, res) => {
    const { action } = req.body;
    if (action === 'pause') {
        isSystemPaused = true;
        console.log('[ALERT] SYSTEM PAUSED BY CIRCUIT BREAKER');
        return res.json({ status: 'PAUSED', message: 'All critical operations suspended.' });
    } else if (action === 'resume') {
        isSystemPaused = false;
        console.log('[INFO] SYSTEM RESUMED');
        return res.json({ status: 'ACTIVE', message: 'Operations resumed.' });
    }
    res.status(400).json({ error: 'Invalid action' });
});

// Middleware to enforce Circuit Breaker
app.use((req, res, next) => {
    if (isSystemPaused && req.method === 'POST') {
        return res.status(503).json({ 
            error: 'SYSTEM_PAUSED', 
            message: 'Critical operations are currently suspended by NeuralSOC Circuit Breaker.' 
        });
    }
    next();
});

databaseShapeReady.finally(() => {

    http.createServer(app).listen(PORT, '0.0.0.0', () => {
        console.log(`Backend TFG running on internal HTTP port ${PORT}`);
    });
});
