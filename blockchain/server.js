const express = require('express');
const cors = require('cors');
const Web3 = require('web3');
const path = require('path');
const fs = require('fs');
const client = require('prom-client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();

// Configuración de CORS para permitir conexiones desde los túneles de Cloudflare
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const JWT_SECRET = "TFG_ULTRA_SECRET_KEY_2026";

// --- 1. CONFIGURACIÓN DE POSTGRES ---
const pool = new Pool({
    host: 'tfg_db',
    user: 'julio_admin',
    password: 'tfg_password_2026',
    database: 'erp_universitario',
    port: 5432,
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

register.registerMetric(notasCounter);
register.registerMetric(alertsCounter);

// --- 3. CONFIGURACIÓN DE RED Y CONTRATOS ---
const web3 = new Web3('http://tfg_ganache_final:8545');

const cargarContratoTruffle = (nombreJson) => {
    try {
        const artifact = require(`./build/contracts/${nombreJson}.json`);
        const networkId = Object.keys(artifact.networks).pop();
        const address = artifact.networks[networkId].address;
        return new web3.eth.Contract(artifact.abi, address);
    } catch (error) {
        console.log(`Contrato ${nombreJson} no cargado aún.`);
        return null;
    }
};

const contract = cargarContratoTruffle('Notas');
const securityContract = cargarContratoTruffle('SecurityManager');

// --- 4. MIDDLEWARES ---
const verifyToken = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header) return res.status(403).json({ success: false, message: "Token requerido" });
    const token = header.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, message: "Token inválido" });
        req.user = decoded;
        next();
    });
};

const checkRole = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "No autorizado" });
    }
    next();
};

// --- 5. RUTAS API ---

app.post('/api/login', async (req, res) => {
    const { user, pass } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [user]);
        const foundUser = result.rows[0];

        if (foundUser && (pass === 'admin123' || pass === 'profe123' || pass === 'alumno123')) {
            const token = jwt.sign({
                id: foundUser.id,
                user: foundUser.username,
                role: foundUser.role,
                name: foundUser.full_name
            }, JWT_SECRET, { expiresIn: '2h' });

            res.json({ success: true, token, role: foundUser.role, name: foundUser.full_name });
        } else {
            res.status(401).json({ success: false, message: "Credenciales incorrectas" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/my-students', verifyToken, checkRole(['TEACHER']), async (req, res) => {
    try {
        const query = `
            SELECT c.id as course_id, c.course_name, u.full_name as student_name
            FROM courses c
            JOIN enrollments e ON c.id = e.course_id
            JOIN users u ON e.student_id = u.id
            WHERE c.teacher_id = $1
        `;
        const result = await pool.query(query, [req.user.id]);
        const formattedData = {};
        result.rows.forEach(row => {
            if (!formattedData[row.course_id]) {
                formattedData[row.course_id] = { courseName: row.course_name, students: [] };
            }
            formattedData[row.course_id].students.push(row.student_name);
        });
        res.json(Object.values(formattedData));
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- RUTA ACTUALIZADA: SUBIR NOTA (BLOCKCHAIN + DATABASE) ---
app.post('/api/subir-nota', verifyToken, checkRole(['TEACHER', 'RECTOR']), async (req, res) => {
    try {
        const { estudiante, asignatura, nota } = req.body;
        const accounts = await web3.eth.getAccounts();

        if (!contract) throw new Error("Contrato Notas no desplegado");

        // 1. Sellar en Blockchain
        const receipt = await contract.methods.emitirCertificado(estudiante, asignatura, parseInt(nota))
            .send({ from: accounts[0], gas: 3000000 });

        const txHash = receipt.transactionHash;

        // 2. Guardar en PostgreSQL (ERP local)
        const queryDB = `
            INSERT INTO grades (student_email, subject, grade, blockchain_hash)
            VALUES ($1, $2, $3, $4)
        `;
        await pool.query(queryDB, [estudiante, asignatura, nota, txHash]);

        notasCounter.inc();
        res.json({ success: true, txHash: txHash });
    } catch (error) {
        console.error("Error en subir-nota:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- NUEVA RUTA: CONSULTAR NOTAS (HISTÓRICO) ---
app.get('/api/consultar-notas', verifyToken, checkRole(['TEACHER', 'RECTOR']), async (req, res) => {
    try {
        const query = `
            SELECT student_email, subject, grade, blockchain_hash, timestamp 
            FROM grades 
            ORDER BY timestamp DESC
        `;
        const result = await pool.query(query);
        res.json({ success: true, notas: result.rows });
    } catch (err) {
        console.error("Error en consultar-notas:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

app.get('/api/health-check', (req, res) => {
    res.json({ status: "online", blockchain: !!contract });
});

app.listen(3000, '0.0.0.0', () => {
    console.log("🚀 API TFG en puerto 3000");
});
