/**
 * @file Gestor de salas del juego
 * @module rooms/manager
 */

const crypto = require('crypto');
const config = require('../config');
const { createPlayersArray } = require('./player');
const logger = require('../utils/logger');

/**
 * @typedef {Object} Room
 * @property {Player[]} players - Array de jugadores
 * @property {Set<string>} sockets - IDs de sockets conectados
 * @property {number} createdAt - Timestamp de creación
 */

/**
 * Gestiona el ciclo de vida de las salas
 */
class RoomManager {
  /**
   * @constructor
   * @param {config} [cfg] - Configuración opcional
   */
  constructor(cfg = null) {
    this.config = cfg || config;
    this.rooms = new Map();
  }

  /**
   * Genera un código de sala único
   * @returns {string} Código de sala
   */
  generateRoomCode() {
    let code;
    do {
      code = Array.from({ length: this.config.ROOM_CODE_LENGTH }, () =>
        this.config.ROOM_CODE_CHARS[crypto.randomInt(this.config.ROOM_CODE_CHARS.length)]
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Crea una nueva sala
   * @returns {{ code: string, room: Room }}
   */
  createRoom() {
    const code = this.generateRoomCode();
    const room = {
      players: createPlayersArray(),
      sockets: new Set(),
      createdAt: Date.now()
    };
    
    this.rooms.set(code, room);
    logger.info({ code, players: this.config.MAX_PLAYERS }, 'Sala creada');
    
    return { code, room };
  }

  /**
   * Obtiene una sala por código
   * @param {string} code - Código de la sala
   * @returns {Room|null}
   */
  getRoom(code) {
    return this.rooms.get(code) || null;
  }

  /**
   * Elimina una sala
   * @param {string} code - Código de la sala
   * @returns {boolean} True si se eliminó
   */
  deleteRoom(code) {
    const deleted = this.rooms.delete(code);
    if (deleted) {
      logger.info({ code }, 'Sala eliminada');
    }
    return deleted;
  }

  /**
   * Limpia salas vacías después del timeout configurado
   * @returns {number} Cantidad de salas limpiadas
   */
  cleanupEmptyRooms() {
    const now = Date.now();
    const cleanupDelay = this.config.ROOM_CLEANUP_DELAY;
    let cleaned = 0;
    
    for (const [code, room] of this.rooms.entries()) {
      if (room.sockets.size === 0 && now - room.createdAt > cleanupDelay) {
        this.rooms.delete(code);
        logger.info({ code, age: now - room.createdAt }, 'Sala vacía limpiada');
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Obtiene estadísticas de salas
   * @returns {{ total: number, activePlayers: number }}
   */
  getStats() {
    let activePlayers = 0;
    for (const room of this.rooms.values()) {
      activePlayers += room.players.filter(p => p.connected).length;
    }
    
    return {
      total: this.rooms.size,
      activePlayers
    };
  }
}

module.exports = RoomManager;
