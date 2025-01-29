let chatMessages = [];
let selectedGroup = null;

// Socket.IO client connection
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

// Save messages to local storage
function saveMessagesToLocalStorage(messages, groupId) {
    const recentMessages = messages.slice(-10); // Keep last 10 messages
    localStorage.setItem(`chatMessages_${groupId}`, JSON.stringify(recentMessages));
}

// Load messages from local storage
function loadMessagesFromLocalStorage(groupId) {
    const storedMessages = localStorage.getItem(`chatMessages_${groupId}`);
    return storedMessages ? JSON.parse(storedMessages) : [];
}

// Fetch groups for the user
async function fetchGroups() {
    try {
        const response = await axios.get('http://localhost:3000/groups');
        const groups = response.data;
        const groupSelect = document.getElementById('group-select');
        groupSelect.innerHTML = `<option value="">Select a Group</option>`;

        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });

        // Check if there is a previously selected group
        const lastSelectedGroup = localStorage.getItem('selectedGroup');
        if (lastSelectedGroup) {
            groupSelect.value = lastSelectedGroup;
            selectedGroup = parseInt(lastSelectedGroup, 10);
            await fetchGroupMessages();
        }
    } catch (err) {
        console.error('Error fetching groups:', err);
    }
}

// Fetch messages for the selected group
async function fetchGroupMessages() {
    try {
        const groupId = document.getElementById('group-select').value;
        if (!groupId) return;

        selectedGroup = parseInt(groupId, 10); // Convert to number
        localStorage.setItem('selectedGroup', selectedGroup); // Save as number (converts to string in localStorage)

        // Join the group room
        socket.emit('join-group', selectedGroup);

        // Fetch messages from the server
        const response = await axios.get(`http://localhost:3000/group/${selectedGroup}/messages`);
        const newMessages = response.data.map(msg => ({
            id: msg.id,
            message: msg.message,
            user: msg.user ? msg.user.name : 'Unknown',
            createdAt: msg.createdAt
        }));

        chatMessages = newMessages;
        saveMessagesToLocalStorage(chatMessages, groupId);
        displayChat();
    } catch (err) {
        console.error('Error fetching group messages:', err);
    }
}

// Display chat messages
function displayChat() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';
    const currentUserId = localStorage.getItem('userId'); // You need to store this when logging in

    chatMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        const isCurrentUser = msg.userId === parseInt(currentUserId, 10);

        messageDiv.className = `chat-message ${isCurrentUser ? 'my-message' : 'other-message'}`;
        messageDiv.innerHTML = `
            <div class="message-user">${msg.user || 'Unknown'}</div>
            <div>${msg.message}</div>
            <div class="message-time">${new Date(msg.createdAt).toLocaleTimeString()}</div>
        `;
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send a message
async function sendChat(event) {
    try {
        event.preventDefault();
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();

        if (!message) throw new Error('Message cannot be empty');
        if (!selectedGroup) throw new Error('Please select a group');

        // Send the message to the server
        const response = await axios.post(`http://localhost:3000/group/${selectedGroup}/message`, { message });
        const newMessage = response.data;

        // Add the new message to chatMessages and update the UI
        chatMessages.push({
            id: newMessage.id,
            message: newMessage.message,
            user: newMessage.user.name,
            createdAt: newMessage.createdAt
        });
        saveMessagesToLocalStorage(chatMessages, selectedGroup);
        displayChat();

        chatInput.value = ''; // Clear the input field
    } catch (err) {
        const errorMsg = err.response?.data?.message || err.message;
        console.error('Error sending message:', errorMsg);
    }
}

// Create a new group
async function createGroup() {
    try {
        const groupName = prompt('Enter group name:');
        if (!groupName) return;

        const response = await axios.post('http://localhost:3000/group', { name: groupName });
        alert(`Group "${response.data.group.name}" created successfully!`);
        fetchGroups();
    } catch (err) {
        console.error('Error creating group:', err);
    }
}

// Real-time updates for new messages
socket.on('new-group-message', (newMsg) => {
    if (newMsg.groupId === selectedGroup) {
        chatMessages.push({
            id: newMsg.id,
            message: newMsg.message,
            user: newMsg.user,
            createdAt: newMsg.createdAt
        });

        saveMessagesToLocalStorage(chatMessages, selectedGroup);
        displayChat(); // Update the UI
    }
});

// Search and add user to group
async function searchAndAddUser() {
    try {
        const searchQuery = prompt('Enter name, email, or phone number:');
        if (!searchQuery) return;

        const response = await axios.get(`http://localhost:3000/users/search?query=${searchQuery}`);
        const users = response.data;

        if (users.length === 0) {
            alert('No users found');
            return;
        }

        const userId = prompt('Enter the ID of the user to add:');
        if (!userId) return;

        await axios.post(`http://localhost:3000/group/${selectedGroup}/add`, { userId });
        alert('User added to group');
    } catch (err) {
        console.error('Error searching and adding user:', err);
    }
}

// Make user admin
async function makeUserAdmin() {
    try {
        const userId = prompt('Enter the ID of the user to make admin:');
        if (!userId) return;

        await axios.post(`http://localhost:3000/group/${selectedGroup}/makeAdmin`, { userId });
        alert('User made admin');
    } catch (err) {
        console.error('Error making user admin:', err);
    }
}

// Remove user from group
async function removeUserFromGroup() {
    try {
        const userId = prompt('Enter the ID of the user to remove:');
        if (!userId) return;

        await axios.post(`http://localhost:3000/group/${selectedGroup}/remove`, { userId });
        alert('User removed from group');
    } catch (err) {
        console.error('Error removing user from group:', err);
    }
}

// Load groups and messages on initial load
window.onload = async () => {
    await fetchGroups();

    // Add event listener for group selection change
    document.getElementById('group-select').addEventListener('change', async () => {
        const groupId = document.getElementById('group-select').value;
        if (groupId) {
            selectedGroup = parseInt(groupId, 10);
            localStorage.setItem('selectedGroup', selectedGroup);
            await fetchGroupMessages();
        }
    });
};