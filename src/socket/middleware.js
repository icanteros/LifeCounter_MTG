/**
 * @file Middleware de autorización y validación para sockets
 * @module socket/middleware
 */

const config = require('../config');
const { validateInput } = require('../utils/sanitizer');

/**
 * @typedef {Object} SocketData
 * @property {string} roomCode - Código de la sala
 * @property {number} playerSlot - Slot del jugador
 * @property {number} joinedAt - Timestamp de conexión
 */

/**
 * @typedef {Object} SocketWithData
 * @property {string} id
 * @property {SocketData} data
 * @property {Function} emit
 */

/**
 * Verifica si un socket puede modificar un jugador
 * @param {SocketWithData} socket - Socket con datos
 * @param {number} targetPid - ID del jugador objetivo
 * @returns {boolean} True si está autorizado
 */
function canPlayerModify(socket, targetPid) {
  return socket.data.playerSlot === targetPid;
}

/**
 * Valida el código de una sala
 * @param {any} code - Código a validar
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateRoomCode(code) {
  const result = validateInput(code, {
    maxLength: config.ROOM_CODE_LENGTH,
    required: true,
    pattern: /^[A-Z0-9]+$/
  });
  
  if (!result.valid) {
    return { valid: false, error: 'Código de sala inválido' };
  }
  
  if (result.value.length !== config.ROOM_CODE_LENGTH) {
    return { valid: false, error: 'Código debe tener 5 caracteres' };
  }
  
  return { valid: true, error: null };
}

/**
 * Valida el slot de un jugador
 * @param {any} slot - Slot a validar
 * @returns {{ valid: boolean, slot: number|null, error: string|null }}
 */
function validatePlayerSlot(slot) {
  const parsed = parseInt(slot, 10);
  
  if (isNaN(parsed) || parsed < config.MIN_PLAYERS || parsed > config.MAX_PLAYERS) {
    return { valid: false, slot: null, error: 'Slot inválido (debe ser 1-4)' };
  }
  
  return { valid: true, slot: parsed, error: null };
}

/**
 * Opciones de CORS para Socket.IO
 * @param {string} origin - Origen de la request
 * @param {Function} callback - Callback de CORS
 */
function corsOptions(origin, callback) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5173'];
  
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(null, false);
  }
}

module.exports = { canPlayerModify, validateRoomCode, validatePlayerSlot, corsOptions };
