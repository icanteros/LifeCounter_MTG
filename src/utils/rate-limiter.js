/**
 * @file Sistema de rate limiting para eventos de socket
 * @module utils/rate-limiter
 */

const logger = require('./logger');

/**
 * @typedef {Object} RateLimitState
 * @property {number[]} events - Timestamps de eventos
 * @property {number[]} roomCreates - Timestamps de creación de salas
 */

/**
 * Clase para gestionar rate limiting por socket
 */
class RateLimiter {
  /**
   * @constructor
   * @param {Map<string, RateLimitState>} [stateMap=new Map()]
   */
  constructor(stateMap = new Map()) {
    this.stateMap = stateMap;
  }

  /**
   * Verifica si un socket puede realizar un evento
   * @param {string} socketId - ID del socket
   * @param {number} limit - Máximo de eventos permitidos
   * @param {number} windowMs - Ventana de tiempo en ms
   * @returns {boolean} True si está permitido
   */
  check(socketId, limit, windowMs) {
    const now = Date.now();
    
    if (!this.stateMap.has(socketId)) {
      this.stateMap.set(socketId, { events: [], roomCreates: [] });
    }
    
    const state = this.stateMap.get(socketId);
    state.events = state.events.filter(t => now - t < windowMs);
    
    if (state.events.length >= limit) {
      logger.warn({ socketId, limit, windowMs }, 'Rate limit excedido para evento');
      return false;
    }
    
    state.events.push(now);
    return true;
  }

  /**
   * Verifica si un socket puede crear una sala
   * @param {string} socketId - ID del socket
   * @param {number} limit - Máximo de creaciones permitidas
   * @param {number} windowMs - Ventana de tiempo en ms
   * @returns {boolean} True si está permitido
   */
  checkRoomCreate(socketId, limit, windowMs) {
    const now = Date.now();
    
    if (!this.stateMap.has(socketId)) {
      this.stateMap.set(socketId, { events: [], roomCreates: [] });
    }
    
    const state = this.stateMap.get(socketId);
    state.roomCreates = state.roomCreates.filter(t => now - t < windowMs);
    
    if (state.roomCreates.length >= limit) {
      logger.warn({ socketId, limit, windowMs }, 'Rate limit excedido para creación de sala');
      return false;
    }
    
    state.roomCreates.push(now);
    return true;
  }

  /**
   * Limpia el estado de rate limiting de un socket
   * @param {string} socketId - ID del socket
   */
  cleanup(socketId) {
    this.stateMap.delete(socketId);
  }
}

module.exports = RateLimiter;
