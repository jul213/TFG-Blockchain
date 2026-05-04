const express = require('express');
const cors = require('cors');
const Web3 = require('web3');
const path = require('path'); // Mejora: Para manejar carpetas
const app = express();

app.use(cors());
app.use(express.json());

// MEJORA: Servir archivos estáticos del frontend
// Esto hace que Cloudflare pueda mostrar tu index.html
app.use(express.static(path.join(__dirname, '../frontend')));

// MEJORA: Ruta raíz para cargar la web
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Configuración de Web3 y Contrato
// Cambia la línea de Web3 por esta versión más compatible:
const web3 = new Web3('http://127.0.0.1:8545');
const contractABI = [{"inputs": [], "stateMutability": "nonpayable", "type": "constructor"}, {"anonymous": false, "inputs": [{"indexed": true, "internalType": "bytes32", "name": "hashId", "type": "bytes32"}, {"indexed": false, "internalType": "string", "name": "estudiante", "type": "string"}, {"indexed": false, "internalType": "string", "name": "asignatura", "type": "string"}, {"indexed": false, "internalType": "uint256", "name": "nota", "type": "uint256"}, {"indexed": false, "internalType": "uint256", "name": "fecha", "type": "uint256"}, {"indexed": false, "internalType": "address", "name": "emisor", "type": "address"}], "name": "CertificadoEmitido", "type": "event"}, {"inputs": [], "name": "administrador", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "address", "name": "", "type": "address"}], "name": "profesoresAutorizados", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function"}, {"inputs": [{"internalType": "string", "name": "_estudiante", "type": "string"}, {"internalType": "string", "name": "_asignatura", "type": "string"}, {"internalType": "uint256", "name": "_nota", "type": "uint256"}], "name": "emitirCertificado", "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}], "stateMutability": "nonpayable", "type": "function"}, {"inputs": [{"internalType": "bytes32", "name": "_hashId", "type": "bytes32"}], "name": "verificarCertificado", "outputs": [{"internalType": "string", "name": "estudiante", "type": "string"}, {"internalType": "string", "name": "asignatura", "type": "string"}, {"internalType": "uint256", "name": "nota", "type": "uint256"}, {"internalType": "uint256", "name": "fecha", "type": "uint256"}, {"internalType": "address", "name": "emisor", "type": "address"}], "stateMutability": "view", "type": "function"}];
const contractAddress = '0x8b76a15D224Cf07A1Fc20354A97E2f103DbF6514';
const contract = new web3.eth.Contract(contractABI, contractAddress);

// RUTA REGISTRO (Coincide con el frontend)
app.post('/subir-nota', async (req, res) => {
    try {
        const { estudiante, asignatura, nota } = req.body;
        const accounts = await web3.eth.getAccounts();

        const receipt = await contract.methods.emitirCertificado(estudiante, asignatura, parseInt(nota))
            .send({ from: accounts[0], gas: 3000000 });

        res.json({ success: true, txHash: receipt.transactionHash });
    } catch (error) {
        console.error("Error en /subir-nota:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// RUTA CONSULTA
app.get('/obtener-nota/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const events = await contract.getPastEvents('CertificadoEmitido', {
            fromBlock: 0,
            toBlock: 'latest'
        });

        const info = events.find(e => e.transactionHash.toLowerCase() === hash.toLowerCase());

        if (info) {
            res.json({
                success: true,
                nota: {
                    estudiante: info.returnValues.estudiante,
                    asignatura: info.returnValues.asignatura,
                    calificacion: info.returnValues.nota.toString(),
                    fecha: new Date(Number(info.returnValues.fecha) * 1000).toLocaleString()
                }
            });
        } else {
            res.status(404).json({ success: false });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Escuchar en el puerto 3000
app.listen(3000, '0.0.0.0', () => {
    console.log("-----------------------------------------");
    console.log("Servidor Online en Puerto 3000");
    console.log("Listo para recibir peticiones de Cloudflare");
    console.log("-----------------------------------------");
});
