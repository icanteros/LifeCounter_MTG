const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const STARTING_LIFE = 40;

// Global Error Handlers (Helpful for Railway Debugging)
process.on('uncaughtException', (err) => {
    console.error('💥 FATAL ERROR (Uncaught Exception):', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
});

// ── Rooms state ────────────────────────────────────────────────────────────
// Map<roomCode, { players: [...], sockets: Set<socketId> }>
const rooms = new Map();

function createRoomState() {
    return [1, 2, 3, 4].map(id => ({
        id,
        name: `Jugador ${id}`,
        life: STARTING_LIFE,
        poison: 0,
        poisonLabel: '☠ Veneno',
        commanderTax: 0,
        commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0 },
        mana: { w: 0, u: 0, b: 0, r: 0, g: 0, c: 0 },
        theme: 'default',
        connected: false,
    }));
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        code = Array.from({ length: 5 }, () =>
            chars[crypto.randomInt(chars.length)]
        ).join('');
    } while (rooms.has(code));
    return code;
}

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.status(200).send('OK'));

// ── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

    // Create a new room
    socket.on('create_room', () => {
        const code = generateRoomCode();
        rooms.set(code, {
            players: createRoomState(),
            sockets: new Set(),
        });
        socket.emit('room_created', { code });
    });

    // Join an existing room
    socket.on('join_room', ({ code, playerSlot }) => {
        const room = rooms.get(code);
        if (!room) {
            socket.emit('error', { message: 'Sala no encontrada. Revisá el código.' });
            return;
        }

        // Validate player slot (1-4)
        const slot = parseInt(playerSlot);
        if (slot < 1 || slot > 4) {
            socket.emit('error', { message: 'Slot de jugador inválido.' });
            return;
        }

        // Check if slot is already taken
        const player = room.players.find(p => p.id === slot);
        if (player.connected) {
            socket.emit('error', { message: `El lugar ${slot} ya está ocupado.` });
            return;
        }

        // Mark slot as connected and link to socket
        player.connected = true;
        room.sockets.add(socket.id);
        socket.data.roomCode = code;
        socket.data.playerSlot = slot;
        socket.join(code);

        // Send current room state to the joining client
        socket.emit('joined_room', {
            code,
            players: room.players,
            mySlot: slot,
        });

        // Notify others
        io.to(code).emit('game_state', { players: room.players });
    });

    // Life change
    socket.on('life_change', ({ pid, delta }) => {
        const room = rooms.get(socket.data.roomCode);
        if (!room) return;
        const player = room.players.find(p => p.id === pid);
        if (!player) return;
        player.life = Math.max(-999, player.life + delta);
        io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // Generic counter change
    socket.on('counter_change', ({ pid, type, delta, color, target, label }) => {
        const room = rooms.get(socket.data.roomCode);
        if (!room) return;
        const p = room.players.find(p => p.id === pid);
        if (!p) return;

        if (type === 'mana' && color) {
            p.mana[color] = Math.max(0, p.mana[color] + delta);
        } else if (type === 'cmdrDmg' && target) {
            p.commanderDamage[target] = Math.max(0, p.commanderDamage[target] + delta);
        } else if (type === 'tax') {
            p.commanderTax = Math.max(0, p.commanderTax + delta);
        } else if (type === 'poison') {
            p.poison = Math.max(0, p.poison + delta);
        } else if (type === 'poisonLabel') {
            p.poisonLabel = label;
        } else if (type === 'theme') {
            p.theme = label; // Usamos label como valor de tema
        }

        io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // Name change
    socket.on('name_change', ({ pid, name }) => {
        const room = rooms.get(socket.data.roomCode);
        if (!room) return;
        const player = room.players.find(p => p.id === pid);
        if (!player) return;
        player.name = String(name).slice(0, 20);
        io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // Reset game
    socket.on('reset_game', () => {
        const room = rooms.get(socket.data.roomCode);
        if (!room) return;
        room.players.forEach((p, i) => {
            p.life = STARTING_LIFE;
            p.poison = 0;
            p.poisonLabel = '☠ Veneno';
            p.commanderTax = 0;
            p.commanderDamage = { 1: 0, 2: 0, 3: 0, 4: 0 };
            p.mana = { w: 0, u: 0, b: 0, r: 0, g: 0, c: 0 };
            p.theme = 'default';
            p.name = `Jugador ${p.id}`;
        });
        io.to(socket.data.roomCode).emit('game_state', { players: room.players });
    });

    // Disconnect
    socket.on('disconnect', () => {
        const code = socket.data.roomCode;
        const slot = socket.data.playerSlot;
        if (!code) return;
        const room = rooms.get(code);
        if (!room) return;

        const player = room.players.find(p => p.id === slot);
        if (player) player.connected = false;
        room.sockets.delete(socket.id);

        io.to(code).emit('game_state', { players: room.players });

        // Clean up empty rooms after 30 min
        if (room.sockets.size === 0) {
            setTimeout(() => {
                if (rooms.has(code) && rooms.get(code).sockets.size === 0) {
                    rooms.delete(code);
                }
            }, 30 * 60 * 1000);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n⚔  MTG Life Counter Server v2.0.0`);
    console.log(`   - Puerto: ${PORT} (0.0.0.0)`);
    console.log(`   - URL Local: http://localhost:${PORT}`);
    console.log(`   - Estado: Listo para batallas multijugador\n`);
});
