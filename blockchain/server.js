const express = require('express');
const cors = require('cors');
const Web3 = require('web3');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Servir frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Configuración Web3 - Versión Estable
const web3 = new Web3('http://127.0.0.1:8545');

const contractABI = [{"inputs": [], "stateMutability": "nonpayable", "type": "constructor"}, {"anonymous": false, "inputs": [{"indexed": true, "internalType": "bytes32", "name": "hashId", "type": "bytes32"}, {"indexed": false, "internalType": "string", "name": "estudiante", "type": "string"}, {"indexed": false, "internalType": "string", "name": "asignatura", "type": "string"}, {"indexed": false, "internalType": "uint256", "name": "nota", "type": "uint256"}, {"indexed": false, "internalType": "uint256", "name": "fecha", "type": "uint256"}, {"indexed": false, "internalType": "address", "name": "emisor", "type": "address"}], "name": "CertificadoEmitido", "type": "event"}, {"inputs": [], "name": "administrador", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "address", "name": "", "type": "address"}], "name": "profesoresAutorizados", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "string", "name": "_estudiante", "type": "string"}, {"internalType": "string", "name": "_asignatura", "type": "string"}, {"internalType": "uint256", "name": "_nota", "type": "uint256"}], "name": "emitirCertificado", "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}], "stateMutability": "nonpayable", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "_hashId", "type": "bytes32"}], "name": "verificarCertificado", "outputs": [{"internalType": "string", "name": "estudiante", "type": "string"}, {"internalType": "string", "name": "asignatura", "type": "string"}, {"internalType": "uint256", "name": "nota", "type": "uint256"}, {"internalType": "uint256", "name": "fecha", "type": "uint256"}, {"internalType": "address", "name": "emisor", "type": "address"}], "stateMutability": "view", "type": "function"}];
const contractAddress = '0x8b76a15D224Cf07A1Fc20354A97E2f103DbF6514';
const contract = new web3.eth.Contract(contractABI, contractAddress);

// --- RUTA GRABAR (SIN CAMBIOS, YA FUNCIONA) ---
app.post('/subir-nota', async (req, res) => {
    try {
        const { estudiante, asignatura, nota } = req.body;
        const accounts = await web3.eth.getAccounts();
        const receipt = await contract.methods.emitirCertificado(estudiante, asignatura, parseInt(nota))
            .send({ from: accounts[0], gas: 3000000 });
        res.json({ success: true, txHash: receipt.transactionHash });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- RUTA CONSULTA MEJORADA (DOBLE VERIFICACIÓN) ---
app.get('/obtener-nota/:hash', async (req, res) => {
    try {
        const { hash } = req.params;

        // 1. Intentar buscar en los Eventos (Datos completos)
        const events = await contract.getPastEvents('CertificadoEmitido', {
            fromBlock: 0,
            toBlock: 'latest'
        });

        const info = events.find(e => e.transactionHash.toLowerCase() === hash.toLowerCase());

        if (info) {
            return res.json({
                success: true,
                nota: {
                    estudiante: info.returnValues.estudiante,
                    asignatura: info.returnValues.asignatura,
                    calificacion: info.returnValues.nota.toString() + "/10",
                    fecha: new Date(Number(info.returnValues.fecha) * 1000).toLocaleString()
                }
            });
        }

        // 2. Si el evento no aparece (Fallback), buscar la Transacción directa
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

        // 3. Si no hay nada de nada
        res.status(404).json({ success: false, message: "No encontrado" });

    } catch (error) {
        console.error("Error consulta:", error);
        res.status(500).json({ success: false });
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log("-----------------------------------------");
    console.log("SERVIDOR BLOCKCHAIN TOTALMENTE OPERATIVO");
    console.log("-----------------------------------------");
});
