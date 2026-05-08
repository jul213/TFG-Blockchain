const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

async function deploy() {
    // CORRECCIÓN CLAVE: Usamos el nombre del servicio de Docker, no 127.0.0.1
    const web3 = new Web3('http://tfg_ganache_final:8545'); 
    
    try {
        // Verificar conexión antes de seguir
        const isListening = await web3.eth.net.isListening();
        console.log("🔗 Conexión con Ganache establecida:", isListening);

        const accounts = await web3.eth.getAccounts();
        const deployer = accounts[0];
        console.log("🚀 Iniciando despliegue con la cuenta:", deployer);

        // 1. Leer el archivo del contrato (Asegúrate de que el nombre sea exacto)
        // Si tu archivo se llama SecurityAudit.sol, cámbialo aquí abajo:
        const contractFileName = 'TFG_CyberShield_V2.sol'; 
        const contractPath = path.resolve(__dirname, contractFileName);
        
        if (!fs.existsSync(contractPath)) {
            throw new Error(`No se encuentra el archivo ${contractFileName} en ${contractPath}`);
        }
        
        const source = fs.readFileSync(contractPath, 'utf8');

        // 2. Configuración para el compilador
        const input = {
            language: 'Solidity',
            sources: {
                [contractFileName]: {
                    content: source,
                },
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['abi', 'evm.bytecode'],
                    },
                },
            },
        };

        console.log("🛠️  Compilando contrato...");
        const output = JSON.parse(solc.compile(JSON.stringify(input)));

        if (output.errors) {
            output.errors.forEach((err) => console.error(err.formattedMessage));
            if (output.errors.some(err => err.severity === 'error')) {
                throw new Error("Fallo en la compilación.");
            }
        }

        // Obtener el nombre del contrato del output
        const contractName = Object.keys(output.contracts[contractFileName])[0];
        const contractData = output.contracts[contractFileName][contractName];
        
        const abi = contractData.abi;
        const bytecode = contractData.evm.bytecode.object;

        // 3. Desplegar
        console.log("📡 Enviando contrato a la red de Docker...");
        const ContractFactory = new web3.eth.Contract(abi);

        const instance = await ContractFactory.deploy({
            data: '0x' + bytecode,
        }).send({
            from: deployer,
            gas: 5000000, // Aumentamos el gas por si acaso
        });

        const contractAddress = instance.options.address;
        console.log("✅ ¡Contrato desplegado con éxito!");
        console.log("📍 Dirección:", contractAddress);

        // 4. Guardar info para el Backend
        const infoToSave = {
            address: contractAddress,
            abi: abi,
            deployedAt: new Date().toISOString(),
            network: "tfg_red_docker"
        };

        fs.writeFileSync(
            path.resolve(__dirname, 'contract_info.json'),
            JSON.stringify(infoToSave, null, 2)
        );

        console.log("💾 Información guardada en 'contract_info.json'");

    } catch (error) {
        console.error("❌ ERROR CRÍTICO:");
        console.error(error.message);
    }
}

deploy();
