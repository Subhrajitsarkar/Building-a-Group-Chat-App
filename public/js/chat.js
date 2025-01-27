let chatMessages = [];

// ➕ Add Socket.IO client connection
const socket = io('http://localhost:3000', {
    auth: {
        token: localStorage.getItem('token')
    }
});

// Add axios interceptor
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

function saveMessagesToLocalStorage(messages) {
    const recentMessages = messages.slice(-10); // Keep last 10 messages
    localStorage.setItem('chatMessages', JSON.stringify(recentMessages));
}

function loadMessagesFromLocalStorage() {
    const storedMessages = localStorage.getItem('chatMessages');
    return storedMessages ? JSON.parse(storedMessages) : [];
}

async function fetchMessages() {
    try {
        const lastMessage = chatMessages[chatMessages.length - 1];
        const lastId = lastMessage ? lastMessage.id : 0;
        const response = await axios.get(`http://localhost:3000/chat/messages?lastId=${lastId}`);
        const newMessages = response.data.map(msg => ({
            id: msg.id,
            message: msg.message,
            user: msg.user ? msg.user.name : 'Unknown',
            createdAt: msg.createdAt
        }));
        if (newMessages.length > 0) {
            chatMessages = [...chatMessages, ...newMessages];
            saveMessagesToLocalStorage(chatMessages);
            displayChat();
        }
    } catch (err) {
        console.error('Error fetching messages:', err);
    }
}

function displayChat() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';

    chatMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `
            <div class="message-user">${msg.user || 'Unknown'}</div>
            <div>${msg.message}</div>
            <div class="message-time">${new Date(msg.createdAt).toLocaleTimeString()}</div>
        `;
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendChat(event) {
    try {
        event.preventDefault();
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();

        if (!message) throw new Error('Message cannot be empty');

        // Send the message to the server
        await axios.post('http://localhost:3000/chat/send', { message });
        chatInput.value = ''; // Clear the input field

        // ➕ Remove the Axios response handling (Socket.IO will handle it)
    } catch (err) {
        const errorMsg = err.response?.data?.message || err.message;
        console.error('Error sending message:', errorMsg);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'system-message';
        errorDiv.textContent = `Error: ${errorMsg}`;
        document.getElementById('messages').appendChild(errorDiv);
    }
}

// ➕ Add Socket.IO listener for real-time updates
socket.on('new-message', (newMsg) => {
    // ✅ Avoid duplicates by checking message ID
    if (!chatMessages.some(msg => msg.id === newMsg.id)) {
        chatMessages.push(newMsg);
        saveMessagesToLocalStorage(chatMessages);
        displayChat();
    }
});

// Load messages from local storage on initial load
window.onload = () => {
    chatMessages = loadMessagesFromLocalStorage();
    displayChat();
    fetchMessages(); // Fetch new messages after initial load
};