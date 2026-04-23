/**
 * @file Entry point del servidor MTG Life Counter
 * @module index
 */

const express = require('express');
const http = require('http');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const RoomManager = require('./rooms/manager');
const RateLimiter = require('./utils/rate-limiter');
const { initializeSocketIO } = require('./socket');

/**
 * @typedef {Object} ServerConfig
 * @property {number} port - Puerto del servidor
 * @property {string} host - Host del servidor
 */

/**
 * Configuración del servidor
 * @type {ServerConfig}
 */
const PORT = process.env.PORT || config.DEFAULT_PORT;
const HOST = '0.0.0.0';

/**
 * Inicializa el servidor Express
 * @returns {{ app: import('express').Application, server: http.Server }}
 */
function createServer() {
  const app = express();
  const server = http.createServer(app);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // Static files
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return { app, server };
}

/**
 * Manejadores de errores globales
 */
function setupErrorHandlers() {
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Error no capturado (uncaughtException)');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason }, 'Promesa no manejada (unhandledRejection)');
  });
}

/**
 * Inicia el servidor
 * @returns {Promise<{ server: http.Server, io: import('socket.io').Server }>}
 */
async function startServer() {
  setupErrorHandlers();

  const roomManager = new RoomManager();
  const rateLimiter = new RateLimiter();
  const { app, server } = createServer();

  const io = initializeSocketIO({
    server,
    roomManager,
    rateLimiter
  });

  return new Promise((resolve) => {
    server.listen(PORT, HOST, () => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:5173'];

      logger.info({
        port: PORT,
        host: HOST,
        origins: allowedOrigins.join(', ')
      }, `
╔══════════════════════════════════════════════╗
║     ⚔  MTG Life Counter Server v2.1.0       ║
╠══════════════════════════════════════════════╣
║  Puerto: ${PORT} (${HOST})`.padEnd(43) + ` ║
║  URL: http://localhost:${PORT}`.padEnd(43) + ` ║
║  CORS: ${allowedOrigins.join(', ')} `.padEnd(43) + ` ║
╠══════════════════════════════════════════════╣
║  Estado: Listo para batallas multijugador    ║
╚══════════════════════════════════════════════╝
`);

      resolve({ server, io });
    });
  });
}

module.exports = { startServer, createServer };
