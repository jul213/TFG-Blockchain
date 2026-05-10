module.exports = {
  apps: [
    {
      name: "ganache-blockchain",
      script: "ganache",
      args: "--host 0.0.0.0 --port 8545 --db /home/julio/tfg_project/ganache_db"
    },
    {
      name: "backend-tfg",
      script: "./blockchain/bootstrap.js",
      interpreter: "node",
      cwd: "/home/julio/tfg_project",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};
