const express = require('express');
const cors = require('cors');
const Web3 = require('web3');
const path = require('path');
const fs = require('fs');
const client = require('prom-client'); 

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. CONFIGURACIÓN DE MÉTRICAS (SOC PRO NIVEL TFG) ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const notasCounter = new client.Counter({
    name: 'tfg_notas_registradas_total',
    help: 'Total de notas selladas en la Blockchain'
});

const alertsCounter = new client.Counter({
    name: 'tfg_alertas_security_total',
    help: 'Total de incidentes detectados con metadatos de seguridad',
    labelNames: ['tipo', 'severidad', 'cvss', 'mitre_tactic']
});

register.registerMetric(notasCounter);
register.registerMetric(alertsCounter);

// --- 2. CONFIGURACIÓN DE RED (DOCKER INTERNAL DNS) ---
const web3 = new Web3('http://tfg_ganache_final:8545');

// --- 3. CARGA DE CONTRATOS ---

// Función para tus contratos de Truffle (Notas y SecurityManager)
const cargarContratoTruffle = (nombreJson) => {
    try {
        const artifact = require(`./build/contracts/${nombreJson}.json`);
        const networkId = Object.keys(artifact.networks).pop();
        const address = artifact.networks[networkId].address;
        console.log(`[OK] ${nombreJson} activo en: ${address}`);
        return new web3.eth.Contract(artifact.abi, address);
    } catch (error) {
        console.error(`[CRÍTICO] Error al cargar ${nombreJson}:`, error.message);
        return null;
    }
};

const contract = cargarContratoTruffle('Notas');
const securityContract = cargarContratoTruffle('SecurityManager');

// Carga del Escudo V2 (Auditoría Forense Inmutable)
let cyberShield = null;
try {
    // CORRECCIÓN DE RUTA: './contract_info.json' porque el working_dir de Docker es /app/blockchain
    const shieldPath = path.join(__dirname, 'contract_info.json');
    if (fs.existsSync(shieldPath)) {
        const shieldData = JSON.parse(fs.readFileSync(shieldPath, 'utf8'));
        cyberShield = new web3.eth.Contract(shieldData.abi, shieldData.address);
        console.log(`[🛡️ SHIELD] Auditoría V2 cargada en: ${shieldData.address}`);
    } else {
        console.error("[⚠️ SHIELD] Archivo contract_info.json no encontrado en la raíz.");
    }
} catch (e) {
    console.error("[⚠️ SHIELD] Error al inicializar Auditoría V2:", e.message);
}

// --- 4. FUNCIÓN MAESTRA DE AUDITORÍA (Doble Registro) ---
async function registrarIncidente(severityNum, category, details, severityName, cvss, mitre) {
    // A. Prometheus (Para gráficas SOC en Grafana)
    alertsCounter.inc({
        tipo: category,
        severidad: severityName,
        cvss: cvss,
        mitre_tactic: mitre
    });

    // B. Blockchain (Para prueba legal/forense inmutable)
    if (cyberShield) {
        try {
            const accounts = await web3.eth.getAccounts();
            await cyberShield.methods.reportIncident(severityNum, category, details)
                .send({ from: accounts[0], gas: 500000 });
            console.log(`[🛡️ BC-LOG] Evento '${category}' sellado en Blockchain.`);
        } catch (err) {
            console.error("❌ Error firmando en Blockchain:", err.message);
        }
    }
}

// --- 5. RUTAS ---

app.use(express.static(path.join(__dirname, '../frontend')));

// RUTA: Subir Nota (Con Auditoría Forense)
app.post('/subir-nota', async (req, res) => {
    try {
        const { estudiante, asignatura, nota } = req.body;
        const accounts = await web3.eth.getAccounts();
        const emisor = accounts[0];

        // 🛡️ RBAC Check con SecurityManager
        if (securityContract) {
            const esProfe = await securityContract.methods.checkAccess(emisor, web3.utils.keccak256("ROLE_PROFESOR")).call();
            if (!esProfe) {
                // REGISTRO DE INCIDENTE EN SOC Y BLOCKCHAIN
                await registrarIncidente(
                    3, // HIGH severity
                    'UNAUTHORIZED_ACCESS_ATTEMPT',
                    `Usuario ${emisor} intentó subir nota sin permisos.`,
                    'HIGH', '7.5', 'T1078.001'
                );

                return res.status(403).json({ success: false, error: "Acceso denegado: No tienes el Rol de Profesor" });
            }
        }

        const receipt = await contract.methods.emitirCertificado(
            estudiante,
            asignatura,
            parseInt(nota)
        ).send({ from: emisor, gas: 3000000 });

        notasCounter.inc(); 
        console.log(`✅ Nota registrada. TX: ${receipt.transactionHash}`);
        res.json({ success: true, txHash: receipt.transactionHash });

    } catch (error) {
        console.error("❌ Error en ruta /subir-nota:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// RUTA: Obtener Nota
app.get('/obtener-nota/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const events = await contract.getPastEvents('CertificadoEmitido', { fromBlock: 0, toBlock: 'latest' });
        const info = events.find(e => e.transactionHash.toLowerCase() === hash.toLowerCase());

        if (info) {
            return res.json({
                success: true,
                nota: {
                    estudiante: info.returnValues.estudiante,
                    asignatura: info.returnValues.asignatura,
                    calificacion: info.returnValues.nota.toString() + "/100",
                    fecha: new Date(Number(info.returnValues.fecha) * 1000).toLocaleString()
                }
            });
        }
        res.status(404).json({ success: false, message: "Hash no encontrado" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// RUTA: Métricas para Grafana
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// RUTA: Salud del Sistema
app.get('/health-check', (req, res) => {
    res.json({
        status: "online",
        blockchain_connected: true,
        contracts: {
            notas: contract?.options.address,
            security: securityContract?.options.address,
            audit_shield_v2: cyberShield?.options.address
        }
    });
});

// --- 6. ARRANQUE ---
app.listen(3000, '0.0.0.0', () => {
    console.log("==================================================");
    console.log("  SISTEMA TFG: NOTAS + SEGURIDAD + SOC + AUDIT V2 ");
    console.log("  API: http://localhost:3000                      ");
    console.log("==================================================");
});
