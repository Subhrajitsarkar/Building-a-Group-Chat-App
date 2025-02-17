let chatMessages = [];
let selectedGroup = null;
let selectedGroupIsAdmin = false;

// Socket.IO client connection
const socket = io('http://localhost:3000', { auth: { token: localStorage.getItem('token') } });

// Automatically attach the JWT token to every Axios request header.
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

// Fetches all groups the user belongs to (with admin info)
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
            // Assuming the join table info is returned as group.groupMember
            option.dataset.isAdmin = group.groupMember ? group.groupMember.isAdmin : false;
            groupSelect.appendChild(option);
        });

        // Validate or clear last selected group
        const lastSelectedGroup = localStorage.getItem('selectedGroup');
        if (lastSelectedGroup && groups.find(g => g.id == lastSelectedGroup)) {
            groupSelect.value = lastSelectedGroup;
            selectedGroup = parseInt(lastSelectedGroup, 10);
            // Also set admin status for the selected group
            const selectedOption = document.querySelector(`#group-select option[value="${lastSelectedGroup}"]`);
            selectedGroupIsAdmin = selectedOption ? selectedOption.dataset.isAdmin === 'true' : false;
            await fetchGroupMessages();
        } else {
            localStorage.removeItem('selectedGroup');
            selectedGroup = null;
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

        selectedGroup = parseInt(groupId, 10);
        localStorage.setItem('selectedGroup', selectedGroup);

        // Update admin status based on the selected option's data attribute
        const selectedOption = document.querySelector(`#group-select option[value="${groupId}"]`);
        selectedGroupIsAdmin = selectedOption ? selectedOption.dataset.isAdmin === 'true' : false;

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
    const currentUserId = localStorage.getItem('userId'); // Ensure you store this on login

    chatMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        // Assuming msg.userId is available if needed for your UI
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

// Sends a new message to the group
async function sendChat(event) {
    try {
        event.preventDefault();
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();

        if (!message) throw new Error('Message cannot be empty');
        if (!selectedGroup) throw new Error('Please select a group');

        const response = await axios.post(`http://localhost:3000/group/${selectedGroup}/message`, { message });
        const newMessage = response.data;

        chatMessages.push({
            id: newMessage.id,
            message: newMessage.message,
            user: newMessage.user.name,
            createdAt: newMessage.createdAt
        });
        saveMessagesToLocalStorage(chatMessages, selectedGroup);
        displayChat();

        chatInput.value = '';
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
        if (!selectedGroupIsAdmin) {
            alert("You are not an admin in this group. You cannot add a user.");
            return;
        }
        const searchQuery = prompt('Enter name, email, or phone number:');
        if (!searchQuery) return;

        const response = await axios.get(`http://localhost:3000/users/search?query=${searchQuery}`);
        const users = response.data;

        if (users.length === 0) {
            alert('No users found');
            return;
        }

        // Now prompt for the user ID to add
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
        if (!selectedGroupIsAdmin) {
            alert("You are not an admin in this group. You cannot make another user admin.");
            return;
        }
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
        if (!selectedGroupIsAdmin) {
            alert("You are not an admin in this group. You cannot remove a user.");
            return;
        }
        const userId = prompt('Enter the ID of the user to remove:');
        if (!userId) return;
        await axios.post(`http://localhost:3000/group/${selectedGroup}/remove`, { userId });
        alert('User removed from group');
    } catch (err) {
        console.error('Error removing user from group:', err);
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
        displayChat();
    }
});

// Load groups and messages on initial load
window.onload = async () => {
    await fetchGroups();

    // Add event listener for group selection change
    document.getElementById('group-select').addEventListener('change', async () => {
        const groupId = document.getElementById('group-select').value;
        if (groupId) {
            selectedGroup = parseInt(groupId, 10);
            // Update admin status from the selected option
            const selectedOption = document.querySelector(`#group-select option[value="${groupId}"]`);
            selectedGroupIsAdmin = selectedOption ? selectedOption.dataset.isAdmin === 'true' : false;
            localStorage.setItem('selectedGroup', selectedGroup);
            await fetchGroupMessages();
        }
    });
};

function refreshChat() {
    fetchGroups();
    if (selectedGroup) {
        fetchGroupMessages();
    }
}