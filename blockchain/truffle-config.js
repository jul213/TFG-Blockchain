module.exports = {
  networks: {
    development: {
      host: "192.168.1.157",     // Tu IP local
      port: 8545,            // EL NUEVO PUERTO QUE NO ESTÁ BLOQUEADO
      network_id: "*",       // Match any network id
      gas: 6721975,
      gasPrice: 20000000000,
    },
  },

  // Configuración del compilador
  compilers: {
    solc: {
      version: "0.8.0",      // Ajusta a la versión de tu contrato si es distinta
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },

  // Directorios (asegúrate de que coincidan con tu estructura)
  contracts_directory: './contracts/',
  contracts_build_directory: './build/contracts/',
};
