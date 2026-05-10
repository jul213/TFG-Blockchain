const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
    const requestId = req.id || 'N/A';
    const statusCode = err.status || 500;
    
    logger.error({
        message: err.message,
        stack: err.stack,
        requestId,
        path: req.path
    });

    res.status(statusCode).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'Ocurrió un error inesperado',
            details: err.details || null,
            requestId
        }
    });
};

module.exports = errorMiddleware;
