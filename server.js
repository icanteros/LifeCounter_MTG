const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const STARTING_LIFE = 40;

// ── Rooms state ────────────────────────────────────────────────────────────
// Map<roomCode, { players: [...], sockets: Set<socketId> }>
const rooms = new Map();

function createRoomState() {
    return [1, 2, 3, 4].map(id => ({
        id,
        name: `Jugador ${id}`,
        life: STARTING_LIFE,
        poison: 0,
        commander: 0,
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

    // Mini counter change (poison / commander)
    socket.on('counter_change', ({ pid, type, delta }) => {
        const room = rooms.get(socket.data.roomCode);
        if (!room) return;
        const player = room.players.find(p => p.id === pid);
        if (!player) return;
        if (type !== 'poison' && type !== 'commander') return;
        player[type] = Math.max(0, player[type] + delta);
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
            p.commander = 0;
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

server.listen(PORT, () => {
    console.log(`\n⚔  MTG Life Counter Server`);
    console.log(`   Corriendo en http://localhost:${PORT}\n`);
});
