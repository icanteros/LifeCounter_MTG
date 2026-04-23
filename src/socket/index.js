/**
 * @file Configuración principal de Socket.IO
 * @module socket
 */

const { Server } = require('socket.io');
const { corsOptions } = require('./middleware');

/**
 * @typedef {Object} SocketConfig
 * @property {import('http').Server} server - Servidor HTTP
 * @property {RoomManager} roomManager - Gestor de salas
 * @property {RateLimiter} rateLimiter - Gestor de rate limiting
 */

/**
 * Inicializa y configura Socket.IO
 * @param {SocketConfig} config - Configuración
 * @returns {import('socket.io').Server}
 */
function initializeSocketIO({ server, roomManager, rateLimiter }) {
  const io = new Server(server, {
    cors: {
      origin: corsOptions,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  const { registerSocketHandlers } = require('./handlers');
  registerSocketHandlers(io, roomManager, rateLimiter);

  return io;
}

module.exports = { initializeSocketIO };
