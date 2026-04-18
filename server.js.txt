const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('✅ Подключен:', socket.id);
    
    socket.on('register', (data) => {
        socket.userName = data.name || 'Гость';
        socket.userId = data.userId || socket.id;
        console.log('📝 Зарегистрирован:', socket.userName);
        
        const roomsList = Array.from(rooms.values()).map(room => ({
            id: room.id,
            name: room.name,
            memberCount: room.members.length
        }));
        socket.emit('rooms_list', roomsList);
    });
    
    socket.on('create_room', (data) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newRoom = {
            id: roomId,
            name: data.name,
            members: [{ id: socket.id, name: socket.userName }],
            videoUrl: null,
            currentTime: 0,
            isPlaying: false
        };
        rooms.set(roomId, newRoom);
        socket.join(roomId);
        socket.currentRoom = roomId;
        
        socket.emit('room_created', newRoom);
        broadcastRoomsList();
        console.log('📁 Создана комната:', data.name, 'ID:', roomId);
    });
    
    socket.on('join_room', (data) => {
        const room = rooms.get(data.roomId);
        if (!room) {
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }
        
        if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
            const oldRoom = rooms.get(socket.currentRoom);
            if (oldRoom) {
                oldRoom.members = oldRoom.members.filter(m => m.id !== socket.id);
                if (oldRoom.members.length === 0) {
                    rooms.delete(socket.currentRoom);
                } else {
                    socket.to(socket.currentRoom).emit('user_left', { name: socket.userName });
                }
            }
        }
        
        if (!room.members.find(m => m.id === socket.id)) {
            room.members.push({ id: socket.id, name: socket.userName });
        }
        
        socket.join(data.roomId);
        socket.currentRoom = data.roomId;
        
        socket.emit('room_joined', {
            room: room,
            videoUrl: room.videoUrl,
            currentTime: room.currentTime,
            isPlaying: room.isPlaying
        });
        socket.to(data.roomId).emit('user_joined', { name: socket.userName });
        broadcastRoomsList();
        console.log('👤', socket.userName, 'присоединился к комнате:', room.name);
    });
    
    socket.on('leave_room', () => {
        if (socket.currentRoom) {
            const room = rooms.get(socket.currentRoom);
            if (room) {
                room.members = room.members.filter(m => m.id !== socket.id);
                if (room.members.length === 0) {
                    rooms.delete(socket.currentRoom);
                } else {
                    socket.to(socket.currentRoom).emit('user_left', { name: socket.userName });
                }
            }
            socket.leave(socket.currentRoom);
            socket.currentRoom = null;
            socket.emit('room_left');
            broadcastRoomsList();
        }
    });
    
    socket.on('chat_message', (data) => {
        if (socket.currentRoom) {
            io.to(socket.currentRoom).emit('chat_message', {
                sender: socket.userName,
                message: data.message
            });
        }
    });
    
    socket.on('load_video', (data) => {
        if (socket.currentRoom) {
            const room = rooms.get(socket.currentRoom);
            if (room) {
                room.videoUrl = data.url;
                room.currentTime = 0;
                room.isPlaying = true;
                io.to(socket.currentRoom).emit('video_loaded', {
                    url: data.url,
                    currentTime: 0,
                    isPlaying: true
                });
                console.log('📺 Видео загружено в комнату:', room.name);
            }
        }
    });
    
    socket.on('disconnect', () => {
        if (socket.currentRoom) {
            const room = rooms.get(socket.currentRoom);
            if (room) {
                room.members = room.members.filter(m => m.id !== socket.id);
                if (room.members.length === 0) {
                    rooms.delete(socket.currentRoom);
                } else {
                    socket.to(socket.currentRoom).emit('user_left', { name: socket.userName });
                }
            }
            broadcastRoomsList();
        }
        console.log('❌ Отключился:', socket.id);
    });
});

function broadcastRoomsList() {
    const roomsList = Array.from(rooms.values()).map(room => ({
        id: room.id,
        name: room.name,
        memberCount: room.members.length
    }));
    io.emit('rooms_list', roomsList);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🎬 RAVE CLONE — СЕРВЕР ЗАПУЩЕН!                           ║
║   🌐 Порт: ${PORT}                                             ║
║   🌍 Доступен из любой точки мира!                          ║
╚══════════════════════════════════════════════════════════════╝
    `);
});
