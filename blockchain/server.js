const express = require('express');
const cors = require('cors');
const Web3 = require('web3');
const path = require('path');
const client = require('prom-client'); // Librería para métricas del SOC
const app = express();

app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE MÉTRICAS (Para tu Grafana) ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const notasCounter = new client.Counter({
    name: 'tfg_notas_registradas_total',
    help: 'Total de notas selladas en la Blockchain'
});
const alertsCounter = new client.Counter({
    name: 'tfg_alertas_seguridad_total',
    help: 'Total de intentos de acceso no autorizados'
});
register.registerMetric(notasCounter);
register.registerMetric(alertsCounter);

// --- CONFIGURACIÓN DE RED Y CARGA AUTOMÁTICA ---
const web3 = new Web3('http://127.0.0.1:8545');

const cargarContrato = (nombreJson) => {
    try {
        const artifact = require(`./build/contracts/${nombreJson}.json`);
        const networkId = Object.keys(artifact.networks).pop();
        const address = artifact.networks[networkId].address;
        console.log(`[OK] ${nombreJson} activo en: ${address}`);
        return new web3.eth.Contract(artifact.abi, address);
    } catch (error) {
        console.error(`[CRÍTICO] Error al cargar ${nombreJson}`);
        return null;
    }
};

const contract = cargarContrato('Notas');
const securityContract = cargarContrato('SecurityManager');

// --- ESCUCHA DE EVENTOS DE SEGURIDAD (Blue Team) ---
// Esto detecta ataques en la Blockchain aunque no pasen por el servidor
if (securityContract) {
    securityContract.events.SecurityAlert({ fromBlock: 'latest' })
    .on('data', event => {
        const { intruder, detail, severity } = event.returnValues;
        console.log(`\n🚨 [ALERTA SOC] Intruso detectado: ${intruder}`);
        console.log(`📌 Detalle: ${detail} | Severidad: ${severity}\n`);
        alertsCounter.inc(); // Aumenta la métrica en Grafana
    });
}

// --- SERVIR FRONTEND ---
app.use(express.static(path.join(__dirname, '../frontend')));

// --- RUTA GRABAR NOTA (Con Check de Seguridad RBAC) ---
app.post('/subir-nota', async (req, res) => {
    try {
        const { estudiante, asignatura, nota } = req.body;
        const accounts = await web3.eth.getAccounts();
        const emisor = accounts[0];

        // 🛡️ PASO DE SEGURIDAD: ¿Es un profesor autorizado?
        if (securityContract) {
            const esProfe = await securityContract.methods.checkAccess(emisor, web3.utils.keccak256("ROLE_PROFESOR")).call();
            if (!esProfe) {
                alertsCounter.inc();
                console.error(`🛑 Bloqueado: ${emisor} intentó subir nota sin permiso.`);
                return res.status(403).json({ success: false, error: "Acceso denegado: No tienes el Rol de Profesor" });
            }
        }

        const receipt = await contract.methods.emitirCertificado(
            estudiante, 
            asignatura, 
            parseInt(nota)
        ).send({ from: emisor, gas: 3000000 });

        notasCounter.inc(); // Actualiza métrica para el SOC
        console.log(`✅ Nota subida por ${emisor}. TX: ${receipt.transactionHash}`);
        res.json({ success: true, txHash: receipt.transactionHash });

    } catch (error) {
        console.error("❌ Error en el proceso:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- RUTA CONSULTAR NOTA (Mantiene tu lógica) ---
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

        const tx = await web3.eth.getTransaction(hash);
        if (tx) {
            return res.json({
                success: true,
                nota: {
                    estudiante: "Certificado Registrado",
                    asignatura: "Bloque: " + tx.blockNumber,
                    calificacion: "Hash Válido",
                    fecha: "Verificado en Ledger"
                }
            });
        }
        res.status(404).json({ success: false, message: "No encontrado" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// --- ENDPOINT PARA PROMETHEUS/GRAFANA ---
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

app.get('/health-check', (req, res) => {
    res.json({
        status: "online",
        blockchain: "Ganache",
        notas_contract: contract?.options.address,
        security_contract: securityContract?.options.address
    });
});

app.listen(3000, '0.0.0.0', () => {
    console.log("==================================================");
    console.log("  SISTEMA TFG: NOTAS + SEGURIDAD + SOC ACTIVO     ");
    console.log("  Monitorización en: http://localhost:3000/metrics ");
    console.log("==================================================");
});
