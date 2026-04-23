/**
 * @file Factory para estados de jugadores
 * @module rooms/player
 */

const config = require('../config');

/**
 * @typedef {Object} Player
 * @property {number} id - ID del jugador (1-4)
 * @property {string} name - Nombre del jugador
 * @property {number} life - Puntos de vida
 * @property {number} poison - Contador de veneno
 * @property {string} poisonLabel - Etiqueta del veneno
 * @property {number} commanderTax - Impuesto de comandante
 * @property {Object.<number, number>} commanderDamage - Daño por comandante
 * @property {Object.<string, number>} mana - Reserva de maná
 * @property {string} theme - Tema visual
 * @property {string|null} commanderImage - URL de la imagen del comandante
 * @property {boolean} connected - Estado de conexión
 */

/**
 * Crea el estado inicial de un jugador
 * @param {number} id - ID del jugador (1-4)
 * @returns {Player} Estado del jugador
 */
function createPlayerState(id) {
  return {
    id,
    name: `Jugador ${id}`,
    life: config.STARTING_LIFE,
    poison: 0,
    poisonLabel: '☠ Veneno',
    commanderTax: 0,
    commanderDamage: Object.fromEntries(
      Array.from({ length: config.MAX_PLAYERS }, (_, i) => [i + 1, 0])
    ),
    mana: { w: 0, u: 0, b: 0, r: 0, g: 0, c: 0 },
    theme: 'default',
    commanderImage: null,
    connected: false
  };
}

/**
 * Resetea un jugador a su estado inicial
 * @param {Player} player - Jugador a resetear
 * @param {boolean} [keepName=false] - Mantener el nombre del jugador
 */
function resetPlayer(player, keepName = false) {
  player.life = config.STARTING_LIFE;
  player.poison = 0;
  player.poisonLabel = '☠ Veneno';
  player.commanderTax = 0;
  player.commanderDamage = Object.fromEntries(
    Array.from({ length: config.MAX_PLAYERS }, (_, i) => [i + 1, 0])
  );
  player.mana = { w: 0, u: 0, b: 0, r: 0, g: 0, c: 0 };
  player.theme = 'default';
  player.commanderImage = null;
  
  if (!keepName) {
    player.name = `Jugador ${player.id}`;
  }
}

/**
 * Crea un array de jugadores inicializados
 * @returns {Player[]} Array de jugadores
 */
function createPlayersArray() {
  return Array.from({ length: config.MAX_PLAYERS }, (_, i) => 
    createPlayerState(i + 1)
  );
}

module.exports = { createPlayerState, resetPlayer, createPlayersArray };
