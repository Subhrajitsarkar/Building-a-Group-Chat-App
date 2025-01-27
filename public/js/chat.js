let chatMessages = [];

// Add axios interceptor
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

async function fetchMessages() {
    try {
        const response = await axios.get('http://localhost:3000/chat/messages');
        chatMessages = response.data.map(msg => ({
            message: msg.message,
            user: msg.user ? msg.user.name : 'Unknown', // lowercase 'user'
            createdAt: msg.createdAt
        }));
        displayChat();
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

        await axios.post('http://localhost:3000/chat/send', { message });
        chatInput.value = '';
        await fetchMessages(); // Fetch messages after sending a new one
    } catch (err) {
        const errorMsg = err.response?.data?.message || err.message;
        console.error('Error sending message:', errorMsg);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'system-message';
        errorDiv.textContent = `Error: ${errorMsg}`;
        document.getElementById('messages').appendChild(errorDiv);
    }
}

//Polling the API every second to fetch new messages
setInterval(() => {
    fetchMessages();
}, 1000);

// Initial load
window.onload = fetchMessages;