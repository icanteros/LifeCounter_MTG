/**
 * @file Handlers de eventos de Socket.IO
 * @module socket/handlers
 */

const config = require('../config');
const logger = require('../utils/logger');
const { canPlayerModify, validateRoomCode, validatePlayerSlot } = require('./middleware');
const { validateInput } = require('../utils/sanitizer');
const { resetPlayer } = require('../rooms/player');

/**
 * Registra todos los handlers de Socket.IO
 * @param {import('socket.io').Server} io - Servidor de Socket.IO
 * @param {RoomManager} roomManager - Gestor de salas
 * @param {RateLimiter} rateLimiter - Gestor de rate limiting
 */
function registerSocketHandlers(io, roomManager, rateLimiter) {
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Cliente conectado');

    // ── CREATE ROOM ──────────────────────────────────────────
    socket.on('create_room', () => {
      if (!rateLimiter.checkRoomCreate(socket.id, config.RATE_LIMIT_CREATE_ROOM, 60000)) {
        socket.emit('error', { message: 'Demasiados intentos. Esperá unos segundos.' });
        return;
      }

      const { code, room } = roomManager.createRoom();
      socket.emit('room_created', { code });
    });

    // ── CHECK ROOM ──────────────────────────────────────────
    socket.on('check_room', ({ code }) => {
      const validation = validateRoomCode(code);
      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      const room = roomManager.getRoom(code);
      if (room) {
        const taken = room.players.filter(p => p.connected).map(p => p.id);
        socket.emit('room_info', { code, taken });
      } else {
        socket.emit('error', { message: 'Sala no encontrada. Revisá el código.' });
      }
    });

    // ── JOIN ROOM ──────────────────────────────────────────
    socket.on('join_room', ({ code, playerSlot }) => {
      const codeValidation = validateRoomCode(code);
      if (!codeValidation.valid) {
        socket.emit('error', { message: codeValidation.error });
        return;
      }

      const slotValidation = validatePlayerSlot(playerSlot);
      if (!slotValidation.valid) {
        socket.emit('error', { message: slotValidation.error });
        return;
      }

      const room = roomManager.getRoom(code);
      if (!room) {
        socket.emit('error', { message: 'Sala no encontrada. Revisá el código.' });
        return;
      }

      const player = room.players.find(p => p.id === slotValidation.slot);
      if (!player) {
        socket.emit('error', { message: 'Slot inválido.' });
        return;
      }

      if (player.connected) {
        socket.emit('error', { message: `El lugar ${slotValidation.slot} ya está ocupado.` });
        return;
      }

      player.connected = true;
      room.sockets.add(socket.id);
      socket.data.roomCode = code;
      socket.data.playerSlot = slotValidation.slot;
      socket.data.joinedAt = Date.now();
      socket.join(code);

      socket.emit('joined_room', {
        code,
        players: room.players,
        mySlot: slotValidation.slot
      });

      io.to(code).emit('game_state', { players: room.players });
      logger.info({ code, slot: slotValidation.slot }, 'Jugador se unió a sala');
    });

    // ── LIFE CHANGE ──────────────────────────────────────────
    socket.on('life_change', ({ pid, delta }) => {
      if (!canPlayerModify(socket, pid)) {
        logger.warn({ socketId: socket.id, pid }, 'Intento no autorizado de life_change');
        return;
      }

      if (!rateLimiter.check(socket.id, config.RATE_LIMIT_EVENTS, config.RATE_LIMIT_WINDOW)) {
        return;
      }

      const deltaNum = parseInt(delta, 10);
      if (isNaN(deltaNum) || Math.abs(deltaNum) > config.MAX_DELTA) {
        socket.emit('error', { message: 'Cambio de vida inválido.' });
        return;
      }

      const room = roomManager.getRoom(socket.data.roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === pid);
      if (!player) return;

      player.life = Math.max(config.MIN_LIFE, Math.min(config.MAX_LIFE, player.life + deltaNum));
      io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // ── COUNTER CHANGE ──────────────────────────────────────────
    socket.on('counter_change', ({ pid, type, delta, color, target, label }) => {
      if (!canPlayerModify(socket, pid)) {
        logger.warn({ socketId: socket.id, pid }, 'Intento no autorizado de counter_change');
        return;
      }

      if (!rateLimiter.check(socket.id, config.RATE_LIMIT_EVENTS, config.RATE_LIMIT_WINDOW)) {
        return;
      }

      const room = roomManager.getRoom(socket.data.roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === pid);
      if (!player) return;

      applyCounterChange(player, { type, delta, color, target, label });
      io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // ── NAME CHANGE ──────────────────────────────────────────
    socket.on('name_change', ({ pid, name }) => {
      if (!canPlayerModify(socket, pid)) {
        logger.warn({ socketId: socket.id, pid }, 'Intento no autorizado de name_change');
        return;
      }

      const room = roomManager.getRoom(socket.data.roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === pid);
      if (!player) return;

      const { value } = validateInput(name, { maxLength: config.MAX_NAME_LENGTH, required: false });
      player.name = value || `Jugador ${pid}`;
      io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // ── REVIVE PLAYER ──────────────────────────────────────────
    socket.on('revive_player', ({ pid }) => {
      if (!canPlayerModify(socket, pid)) {
        logger.warn({ socketId: socket.id, pid }, 'Intento no autorizado de revive_player');
        return;
      }

      const room = roomManager.getRoom(socket.data.roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === pid);
      if (!player) return;

      resetPlayer(player, true);
      io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // ── RESET GAME ──────────────────────────────────────────
    socket.on('reset_game', () => {
      const room = roomManager.getRoom(socket.data.roomCode);
      if (!room) return;

      room.players.forEach(player => {
        resetPlayer(player, true);
      });

      io.to(socket.data.roomCode).emit('game_state', { players: room.players });
      logger.info({ code: socket.data.roomCode }, 'Juego reseteado');
    });

    // ── DISCONNECT ──────────────────────────────────────────
    socket.on('disconnect', () => {
      const code = socket.data.roomCode;
      const slot = socket.data.playerSlot;

      if (code) {
        const room = roomManager.getRoom(code);
        if (room) {
          const player = room.players.find(p => p.id === slot);
          if (player) {
            player.connected = false;
            logger.info({ code, slot }, 'Jugador desconectado');
          }
          room.sockets.delete(socket.id);
          io.to(code).emit('game_state', { players: room.players });

          if (room.sockets.size === 0) {
            setTimeout(() => {
              const currentRoom = roomManager.getRoom(code);
              if (currentRoom && currentRoom.sockets.size === 0) {
                roomManager.deleteRoom(code);
              }
            }, config.ROOM_CLEANUP_DELAY);
          }
        }
      }

      rateLimiter.cleanup(socket.id);
    });
  });
}

/**
 * Aplica un cambio de contador a un jugador
 * @param {Player} player - Jugador
 * @param {Object} change - Datos del cambio
 */
function applyCounterChange(player, { type, delta, color, target, label }) {
  const deltaNum = parseInt(delta, 10);

  switch (type) {
    case 'mana':
      if (color && player.mana.hasOwnProperty(color) && !isNaN(deltaNum)) {
        player.mana[color] = Math.max(0, Math.min(99, player.mana[color] + deltaNum));
      }
      break;
    case 'cmdrDmg':
      if (target && player.commanderDamage.hasOwnProperty(target) && !isNaN(deltaNum)) {
        player.commanderDamage[target] = Math.max(0, Math.min(21, player.commanderDamage[target] + deltaNum));
      }
      break;
    case 'tax':
      if (!isNaN(deltaNum)) {
        player.commanderTax = Math.max(0, Math.min(99, player.commanderTax + deltaNum));
      }
      break;
    case 'poison':
      if (!isNaN(deltaNum)) {
        player.poison = Math.max(0, Math.min(config.POISON_MAX, player.poison + deltaNum));
      }
      break;
    case 'poisonLabel':
      const { value } = validateInput(label, { maxLength: config.MAX_NAME_LENGTH });
      player.poisonLabel = value || '☠ Veneno';
      break;
    case 'theme':
      const allowedThemes = ['default', 'w', 'u', 'b', 'r', 'g', 'c'];
      if (allowedThemes.includes(label)) {
        player.theme = label;
      }
      break;
    case 'commanderImage':
      // label here contains the image URL
      if (typeof label === 'string' && label.length < 500) {
        // basic cleanup to prevent breaking out of url("")
        player.commanderImage = label.replace(/"/g, '').replace(/'/g, '').replace(/\)/g, '');
      } else {
        player.commanderImage = null;
      }
      break;
  }
}

module.exports = { registerSocketHandlers };
