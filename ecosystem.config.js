module.exports = {
  apps: [
    {
      name: "ganache-blockchain",
      script: "ganache",
      args: "--host 0.0.0.0 --port 8545 --db /root/tfg_project/ganache_db"
    },
    {
      name: "backend-tfg",
      script: "./blockchain/server.js",
      cwd: "/root/tfg_project",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
