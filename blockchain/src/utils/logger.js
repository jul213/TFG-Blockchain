const winston = require('winston');
const LokiTransport = require('winston-loki');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Add Loki transport (Internal network address from docker-compose)
logger.add(new LokiTransport({
    host: 'http://tfg_loki:3100',
    labels: { app: 'eblockchain-backend' },
    json: true,
    replaceTimestamp: true
}));

module.exports = logger;
