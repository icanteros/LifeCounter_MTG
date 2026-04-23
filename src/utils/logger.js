/**
 * @file Configuración del logger Pino para el servidor
 * @module utils/logger
 */

const pino = require('pino');

/**
 * Logger configurado con pretty print para desarrollo
 * @constant {import('pino').Logger}
 */
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  },
  level: process.env.LOG_LEVEL || 'info'
});

module.exports = logger;
