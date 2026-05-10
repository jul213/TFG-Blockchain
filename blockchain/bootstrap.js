const net = require('net');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const waitForTcp = (host, port, timeoutMs = 1000) => new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const onError = () => {
        socket.destroy();
        reject(new Error(`${host}:${port}`));
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
        socket.end();
        resolve();
    });
    socket.once('timeout', onError);
    socket.once('error', onError);
});

const waitLoop = async (host, port, label, retries = 30) => {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            await waitForTcp(host, port, 1000);
            console.log(`✅ ${label} disponible en ${host}:${port}`);
            return;
        } catch (_error) {
            if (attempt === retries) {
                throw new Error(`No se pudo conectar con ${label} en ${host}:${port}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
};

async function main() {
    if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
        console.log('📦 Instalando dependencias...');
        execFileSync('npm', ['install'], {
            stdio: 'inherit',
            cwd: __dirname
        });
    }

    await waitLoop('tfg_ganache_final', 8545, 'Ganache');
    await waitLoop('tfg_db', 5432, 'PostgreSQL');

    console.log('📦 Instalando dependencias y desplegando contratos...');
    try {
        execFileSync('npx', ['truffle', 'migrate', '--network', 'development', '--reset', '--compile-all'], {
            stdio: 'inherit',
            cwd: __dirname
        });
    } catch (error) {
        console.error('❌ Falló el despliegue de contratos.');
        process.exit(error.status || 1);
    }

    require('./server');
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
