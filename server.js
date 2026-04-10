const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const app = express();
const server = http.createServer(app);

// Rate limiting state
const rateLimitState = new Map(); // socketId -> { events: [], roomCreates: [] }

function cleanupRateLimitState(socketId) {
    rateLimitState.delete(socketId);
}

function checkRateLimit(socketId, limit, windowMs) {
    const now = Date.now();
    if (!rateLimitState.has(socketId)) {
        rateLimitState.set(socketId, { events: [], roomCreates: [] });
    }
    const state = rateLimitState.get(socketId);

    // Clean old events
    state.events = state.events.filter(t => now - t < windowMs);

    if (state.events.length >= limit) {
        return false;
    }

    state.events.push(now);
    return true;
}

function checkRoomCreateLimit(socketId, limit, windowMs) {
    const now = Date.now();
    if (!rateLimitState.has(socketId)) {
        rateLimitState.set(socketId, { events: [], roomCreates: [] });
    }
    const state = rateLimitState.get(socketId);

    // Clean old room creates
    state.roomCreates = state.roomCreates.filter(t => now - t < windowMs);

    if (state.roomCreates.length >= limit) {
        return false;
    }

    state.roomCreates.push(now);
    return true;
}

// Allowed origins for CORS
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5173'];

function corsOptions(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
    } else {
        console.warn(`Blocked CORS request from: ${origin}`);
        callback(null, false);
    }
}

const io = new Server(server, {
    cors: {
        origin: corsOptions,
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || config.DEFAULT_PORT;

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('💥 FATAL ERROR (Uncaught Exception):', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
});

// ── Rooms state ──────────────────────────────────────────────────────────────
// Map<roomCode, { players: [...], sockets: Set<socketId>, createdAt: number }>
const rooms = new Map();

function createRoomState() {
    return Array.from({ length: config.MAX_PLAYERS }, (_, i) => {
        const id = i + 1;
        return {
            id,
            name: `Jugador ${id}`,
            life: config.STARTING_LIFE,
            poison: 0,
            poisonLabel: '☠ Veneno',
            commanderTax: 0,
            commanderDamage: Object.fromEntries(
                Array.from({ length: config.MAX_PLAYERS }, (_, j) => [j + 1, 0])
            ),
            mana: { w: 0, u: 0, b: 0, r: 0, g: 0, c: 0 },
            theme: 'default',
            connected: false,
        };
    });
}

function generateRoomCode() {
    let code;
    do {
        code = Array.from({ length: config.ROOM_CODE_LENGTH }, () =>
            config.ROOM_CODE_CHARS[crypto.randomInt(config.ROOM_CODE_CHARS.length)]
        ).join('');
    } while (rooms.has(code));
    return code;
}

// Sanitize user input to prevent XSS
function sanitizeString(str, maxLength) {
    if (typeof str !== 'string') return '';
    return str
        .slice(0, maxLength)
        .replace(/[<>\"'&]/g, (char) => {
            const entities = {
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;'
            };
            return entities[char] || char;
        })
        .trim();
}

// Validate that a player can only modify their own state
function canPlayerModify(socket, targetPid) {
    return socket.data.playerSlot === targetPid;
}

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.status(200).send('OK'));

// ── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Create a new room
    socket.on('create_room', () => {
        // Rate limit room creation
        if (!checkRoomCreateLimit(socket.id, config.RATE_LIMIT_CREATE_ROOM, 60000)) {
            socket.emit('error', { message: 'Demasiados intentos. Esperá unos segundos.' });
            return;
        }

        const code = generateRoomCode();
        rooms.set(code, {
            players: createRoomState(),
            sockets: new Set(),
            createdAt: Date.now(),
        });
        socket.emit('room_created', { code });
        console.log(`Room created: ${code} by ${socket.id}`);
    });

    // Check occupied slots
    socket.on('check_room', ({ code }) => {
        if (!code || typeof code !== 'string') {
            socket.emit('error', { message: 'Código de sala inválido.' });
            return;
        }

        const room = rooms.get(code);
        if (room) {
            const taken = room.players.filter(p => p.connected).map(p => p.id);
            socket.emit('room_info', { code, taken });
        } else {
            socket.emit('error', { message: 'Sala no encontrada. Revisá el código.' });
        }
    });

    // Join an existing room
    socket.on('join_room', ({ code, playerSlot }) => {
        // Validate input
        if (!code || typeof code !== 'string') {
            socket.emit('error', { message: 'Código de sala inválido.' });
            return;
        }

        const room = rooms.get(code);
        if (!room) {
            socket.emit('error', { message: 'Sala no encontrada. Revisá el código.' });
            return;
        }

        // Validate player slot (1-4)
        const slot = parseInt(playerSlot, 10);
        if (isNaN(slot) || slot < config.MIN_PLAYERS || slot > config.MAX_PLAYERS) {
            socket.emit('error', { message: 'Slot de jugador inválido (debe ser 1-4).' });
            return;
        }

        // Check if slot is already taken
        const player = room.players.find(p => p.id === slot);
        if (!player) {
            socket.emit('error', { message: 'Slot inválido.' });
            return;
        }
        if (player.connected) {
            socket.emit('error', { message: `El lugar ${slot} ya está ocupado.` });
            return;
        }

        // Mark slot as connected and link to socket
        player.connected = true;
        room.sockets.add(socket.id);
        socket.data.roomCode = code;
        socket.data.playerSlot = slot;
        socket.data.joinedAt = Date.now();
        socket.join(code);

        // Send current room state to the joining client
        socket.emit('joined_room', {
            code,
            players: room.players,
            mySlot: slot,
        });

        // Notify others
        io.to(code).emit('game_state', { players: room.players });
        console.log(`Player ${slot} joined room ${code}`);
    });

    // Life change - SECURED: players can only modify their own life
    socket.on('life_change', ({ pid, delta }) => {
        // Authorization check
        if (!canPlayerModify(socket, pid)) {
            console.warn(`Unauthorized life_change attempt: socket ${socket.id} tried to modify player ${pid}`);
            return;
        }

        // Rate limiting
        if (!checkRateLimit(socket.id, config.RATE_LIMIT_EVENTS, config.RATE_LIMIT_WINDOW)) {
            return;
        }

        // Validate delta
        const deltaNum = parseInt(delta, 10);
        if (isNaN(deltaNum) || Math.abs(deltaNum) > config.MAX_DELTA) {
            socket.emit('error', { message: 'Cambio de vida inválido.' });
            return;
        }

        const room = rooms.get(socket.data.roomCode);
        if (!room) return;

        const player = room.players.find(p => p.id === pid);
        if (!player) return;

        player.life = Math.max(config.MIN_LIFE, Math.min(config.MAX_LIFE, player.life + deltaNum));
        io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // Generic counter change - SECURED: players can only modify their own counters
    socket.on('counter_change', ({ pid, type, delta, color, target, label }) => {
        // Authorization check
        if (!canPlayerModify(socket, pid)) {
            console.warn(`Unauthorized counter_change attempt: socket ${socket.id} tried to modify player ${pid}`);
            return;
        }

        // Rate limiting
        if (!checkRateLimit(socket.id, config.RATE_LIMIT_EVENTS, config.RATE_LIMIT_WINDOW)) {
            return;
        }

        const room = rooms.get(socket.data.roomCode);
        if (!room) return;

        const p = room.players.find(p => p.id === pid);
        if (!p) return;

        // Validate and apply changes based on type
        if (type === 'mana' && color) {
            const deltaNum = parseInt(delta, 10);
            if (!isNaN(deltaNum) && p.mana.hasOwnProperty(color)) {
                p.mana[color] = Math.max(0, Math.min(99, p.mana[color] + deltaNum));
            }
        } else if (type === 'cmdrDmg' && target) {
            const deltaNum = parseInt(delta, 10);
            if (!isNaN(deltaNum) && p.commanderDamage.hasOwnProperty(target)) {
                p.commanderDamage[target] = Math.max(0, Math.min(21, p.commanderDamage[target] + deltaNum));
            }
        } else if (type === 'tax') {
            const deltaNum = parseInt(delta, 10);
            if (!isNaN(deltaNum)) {
                p.commanderTax = Math.max(0, Math.min(99, p.commanderTax + deltaNum));
            }
        } else if (type === 'poison') {
            const deltaNum = parseInt(delta, 10);
            if (!isNaN(deltaNum)) {
                p.poison = Math.max(0, Math.min(config.POISON_MAX, p.poison + deltaNum));
            }
        } else if (type === 'poisonLabel') {
            // Sanitize label to prevent XSS
            p.poisonLabel = sanitizeString(label, config.MAX_NAME_LENGTH);
        } else if (type === 'theme') {
            // Validate theme against known values
            const allowedThemes = ['default', 'blue', 'green', 'red', 'black', 'white', 'forest', 'dark'];
            if (allowedThemes.includes(label)) {
                p.theme = label;
            }
        }

        io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // Revive individual player - SECURED
    socket.on('revive_player', ({ pid }) => {
        // Authorization check - players can only revive themselves
        if (!canPlayerModify(socket, pid)) {
            console.warn(`Unauthorized revive_player attempt: socket ${socket.id} tried to modify player ${pid}`);
            return;
        }

        const room = rooms.get(socket.data.roomCode);
        if (!room) return;

        const player = room.players.find(p => p.id === pid);
        if (!player) return;

        player.life = config.STARTING_LIFE;
        player.poison = 0;
        player.commanderTax = 0;
        player.commanderDamage = Object.fromEntries(
            Array.from({ length: config.MAX_PLAYERS }, (_, i) => [i + 1, 0])
        );
        io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // Name change - SECURED with sanitization
    socket.on('name_change', ({ pid, name }) => {
        // Authorization check
        if (!canPlayerModify(socket, pid)) {
            console.warn(`Unauthorized name_change attempt: socket ${socket.id} tried to modify player ${pid}`);
            return;
        }

        const room = rooms.get(socket.data.roomCode);
        if (!room) return;

        const player = room.players.find(p => p.id === pid);
        if (!player) return;

        // Sanitize name to prevent XSS
        player.name = sanitizeString(name, config.MAX_NAME_LENGTH) || `Jugador ${pid}`;
        io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // Reset game - only allow if player is in the room
    socket.on('reset_game', () => {
        const room = rooms.get(socket.data.roomCode);
        if (!room) return;

        // Reset all players to initial state
        room.players.forEach((p, i) => {
            p.life = config.STARTING_LIFE;
            p.poison = 0;
            p.poisonLabel = '☠ Veneno';
            p.commanderTax = 0;
            p.commanderDamage = Object.fromEntries(
                Array.from({ length: config.MAX_PLAYERS }, (_, j) => [j + 1, 0])
            );
            p.mana = { w: 0, u: 0, b: 0, r: 0, g: 0, c: 0 };
            p.theme = 'default';
            // Keep player names - don't reset them
        });
        io.to(socket.data.roomCode).emit('game_state', { players: room.players });
        console.log(`Game reset in room ${socket.data.roomCode}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        const code = socket.data.roomCode;
        const slot = socket.data.playerSlot;

        if (code) {
            const room = rooms.get(code);
            if (room) {
                const player = room.players.find(p => p.id === slot);
                if (player) {
                    player.connected = false;
                    console.log(`Player ${slot} disconnected from room ${code}`);
                }
                room.sockets.delete(socket.id);
                io.to(code).emit('game_state', { players: room.players });

                // Clean up empty rooms after timeout
                if (room.sockets.size === 0) {
                    setTimeout(() => {
                        if (rooms.has(code) && rooms.get(code).sockets.size === 0) {
                            rooms.delete(code);
                            console.log(`Room ${code} cleaned up (empty)`);
                        }
                    }, config.ROOM_CLEANUP_DELAY);
                }
            }
        }

        // Clean up rate limit state
        cleanupRateLimitState(socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n⚔  MTG Life Counter Server v2.1.0`);
    console.log(`   - Puerto: ${PORT} (0.0.0.0)`);
    console.log(`   - URL Local: http://localhost:${PORT}`);
    console.log(`   - CORS: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`   - Estado: Listo para batallas multijugador con seguridad mejorada\n`);
});
