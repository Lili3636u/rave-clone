// Rave Clone - Полная клиентская часть
const socket = io();

// DOM элементы
const userNameInput = document.getElementById('userNameInput');
const saveNameBtn = document.getElementById('saveNameBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomsContainer = document.getElementById('roomsContainer');
const onlineUsersList = document.getElementById('onlineUsersList');
const memberCount = document.getElementById('memberCount');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const currentRoomName = document.getElementById('currentRoomName');
const inviteBtn = document.getElementById('inviteBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const videoUrlInput = document.getElementById('videoUrlInput');
const loadVideoBtn = document.getElementById('loadVideoBtn');
const videoFrame = document.getElementById('videoFrame');
const noRoomMessage = document.getElementById('noRoomMessage');
const videoControls = document.getElementById('videoControls');
const connectionStatus = document.getElementById('connectionStatus');
const createRoomModal = document.getElementById('createRoomModal');
const inviteModal = document.getElementById('inviteModal');
const toast = document.getElementById('toast');

// Состояние
let currentUser = {
    id: localStorage.getItem('userId') || 'user_' + Math.random().toString(36).substr(2, 9),
    name: localStorage.getItem('userName') || 'Гость'
};
let currentRoom = null;

// Сохраняем ID пользователя
localStorage.setItem('userId', currentUser.id);
userNameInput.value = currentUser.name;

// Регистрация на сервере
socket.emit('register', {
    userId: currentUser.id,
    name: currentUser.name
});

// ========== Обработчики сокетов ==========

socket.on('connect', () => {
    connectionStatus.className = 'connection-status connected';
    connectionStatus.innerHTML = '<i class="fas fa-circle"></i><span>Подключено к серверу</span>';
});

socket.on('disconnect', () => {
    connectionStatus.className = 'connection-status disconnected';
    connectionStatus.innerHTML = '<i class="fas fa-circle"></i><span>Отключено</span>';
    showToast('Потеряно соединение с сервером', 'error');
});

socket.on('rooms_list', (rooms) => {
    renderRoomsList(rooms);
});

socket.on('room_created', (room) => {
    currentRoom = room;
    updateRoomUI();
    showToast(`Комната "${room.name}" создана!`, 'success');
    closeModal(createRoomModal);
});

socket.on('room_joined', (data) => {
    currentRoom = data.room;
    updateRoomUI();
    if (data.videoUrl) {
        loadVideoToPlayer(data.videoUrl);
    }
    showToast(`Вы присоединились к комнате "${data.room.name}"`, 'success');
});

socket.on('room_left', () => {
    currentRoom = null;
    updateRoomUI();
    showToast('Вы покинули комнату', 'info');
});

socket.on('user_joined', (data) => {
    addSystemMessage(`✨ ${data.name} присоединился к комнате`);
    updateMemberCount();
});

socket.on('user_left', (data) => {
    addSystemMessage(`👋 ${data.name} покинул комнату`);
    updateMemberCount();
});

socket.on('chat_message', (data) => {
    addMessage(data.sender, data.message);
});

socket.on('video_loaded', (data) => {
    loadVideoToPlayer(data.url);
    addSystemMessage(`📺 Загружено новое видео`);
});

socket.on('error', (data) => {
    showToast(data.message, 'error');
});

// ========== Функции интерфейса ==========

function renderRoomsList(rooms) {
    if (!roomsContainer) return;
    
    if (rooms.length === 0) {
        roomsContainer.innerHTML = '<div style="text-align:center;padding:20px;color:gray;">Нет активных комнат<br>Создайте первую!</div>';
        return;
    }
    
    roomsContainer.innerHTML = rooms.map(room => `
        <div class="room-item ${currentRoom?.id === room.id ? 'active' : ''}" data-room-id="${room.id}">
            <i class="fas fa-door-open"></i>
            <span class="room-name">${escapeHtml(room.name)}</span>
            <span class="room-member-count">${room.memberCount || 0}</span>
        </div>
    `).join('');
    
    document.querySelectorAll('.room-item').forEach(el => {
        el.addEventListener('click', () => {
            const roomId = el.dataset.roomId;
            if (currentRoom?.id === roomId) return;
            socket.emit('join_room', { roomId });
        });
    });
}

function updateRoomUI() {
    if (currentRoom) {
        noRoomMessage.style.display = 'none';
        videoFrame.style.display = 'block';
        videoControls.style.display = 'flex';
        leaveRoomBtn.style.display = 'flex';
        chatInput.disabled = false;
        sendBtn.disabled = false;
        updateMemberCount();
    } else {
        noRoomMessage.style.display = 'flex';
        videoFrame.style.display = 'none';
        videoControls.style.display = 'none';
        leaveRoomBtn.style.display = 'none';
        chatInput.disabled = true;
        sendBtn.disabled = true;
        onlineUsersList.innerHTML = '';
        memberCount.textContent = '0';
        videoFrame.src = '';
    }
}

function updateMemberCount() {
    if (currentRoom && currentRoom.members) {
        memberCount.textContent = currentRoom.members.length;
        onlineUsersList.innerHTML = currentRoom.members.map(m => `
            <div class="user-item">
                <div class="status-dot"></div>
                <span>${escapeHtml(m.name)}</span>
                ${m.id === currentUser.id ? '<span style="font-size:10px;margin-left:5px;">(Вы)</span>' : ''}
            </div>
        `).join('');
    }
}

function addMessage(sender, message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `
        <span class="message-sender">${escapeHtml(sender)}</span>
        <span class="message-text">${escapeHtml(message)}</span>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function loadVideoToPlayer(url) {
    let videoId = '';
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    if (match) {
        videoId = match[1];
        videoFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    } else {
        videoFrame.src = url;
    }
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openModal(modal) {
    if (modal) modal.style.display = 'flex';
}

function closeModal(modal) {
    if (modal) modal.style.display = 'none';
}

// ========== Обработчики событий ==========

saveNameBtn.addEventListener('click', () => {
    const newName = userNameInput.value.trim();
    if (newName) {
        currentUser.name = newName;
        localStorage.setItem('userName', newName);
        socket.emit('register', { userId: currentUser.id, name: newName });
        showToast(`Имя изменено на ${newName}`, 'success');
        if (currentRoom) updateMemberCount();
    }
});

createRoomBtn.addEventListener('click', () => {
    openModal(createRoomModal);
});

document.getElementById('confirmCreateRoom')?.addEventListener('click', () => {
    const roomName = document.getElementById('roomNameInput').value.trim();
    if (roomName) {
        socket.emit('create_room', { name: roomName });
        document.getElementById('roomNameInput').value = '';
    } else {
        showToast('Введите название комнаты', 'error');
    }
});

inviteBtn?.addEventListener('click', () => {
    if (currentRoom) {
        const inviteLink = window.location.href;
        document.getElementById('inviteLinkInput').value = inviteLink;
        document.getElementById('modalRoomCode').textContent = currentRoom.id;
        openModal(inviteModal);
    }
});

document.getElementById('copyInviteBtn')?.addEventListener('click', () => {
    const input = document.getElementById('inviteLinkInput');
    input.select();
    document.execCommand('copy');
    showToast('Ссылка скопирована!', 'success');
});

leaveRoomBtn?.addEventListener('click', () => {
    if (confirm('Выйти из комнаты?')) {
        socket.emit('leave_room');
    }
});

sendBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message && currentRoom) {
        socket.emit('chat_message', { message });
        addMessage(currentUser.name, message);
        chatInput.value = '';
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendBtn.click();
});

loadVideoBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (url && currentRoom) {
        socket.emit('load_video', { url });
        videoUrlInput.value = '';
    } else if (!currentRoom) {
        showToast('Сначала присоединитесь к комнате', 'error');
    }
});

document.querySelectorAll('.close-modal').forEach(el => {
    el.addEventListener('click', () => {
        closeModal(createRoomModal);
        closeModal(inviteModal);
    });
});

window.addEventListener('click', (e) => {
    if (e.target === createRoomModal) closeModal(createRoomModal);
    if (e.target === inviteModal) closeModal(inviteModal);
});

// Параметр комнаты из URL
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
    setTimeout(() => {
        socket.emit('join_room', { roomId: roomParam });
    }, 1000);
}

console.log('✅ Rave Clone готов!');
