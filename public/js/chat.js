// public/js/chat.js

// Global variables to hold chat state.
let chatMessages = [];
let selectedGroup = null;
let selectedGroupIsAdmin = false;

// Initialize Socket.IO client with JWT token from localStorage.
const socket = io('http://localhost:3000', {
    auth: { token: localStorage.getItem('token') }
});

// Automatically attach the JWT token to every Axios request.
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Save messages to localStorage (keeping the last 10 messages per group).
function saveMessagesToLocalStorage(messages, groupId) {
    const recentMessages = messages.slice(-10);
    localStorage.setItem(`chatMessages_${groupId}`, JSON.stringify(recentMessages));
}

// Load messages from localStorage.
function loadMessagesFromLocalStorage(groupId) {
    const stored = localStorage.getItem(`chatMessages_${groupId}`);
    return stored ? JSON.parse(stored) : [];
}

// Fetch all groups the user belongs to.
async function fetchGroups() {
    try {
        // GET route for groups the user is in.
        const response = await axios.get('http://localhost:3000/group');
        const groups = response.data;
        const groupSelect = document.getElementById('group-select');
        groupSelect.innerHTML = `<option value="">Select a Group</option>`;

        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            // Assuming join table info is returned as group.groupMember
            option.dataset.isAdmin = group.groupMember ? group.groupMember.isAdmin : false;
            groupSelect.appendChild(option);
        });

        // Check if a group was previously selected.
        const lastSelectedGroup = localStorage.getItem('selectedGroup');
        if (lastSelectedGroup && groups.find(g => g.id == lastSelectedGroup)) {
            groupSelect.value = lastSelectedGroup;
            selectedGroup = parseInt(lastSelectedGroup, 10);
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

// Fetch messages for the selected group.
async function fetchGroupMessages() {
    try {
        const groupId = document.getElementById('group-select').value;
        if (!groupId) return;

        selectedGroup = parseInt(groupId, 10);
        localStorage.setItem('selectedGroup', selectedGroup);

        // Update admin status from selected option.
        const selectedOption = document.querySelector(`#group-select option[value="${groupId}"]`);
        selectedGroupIsAdmin = selectedOption ? selectedOption.dataset.isAdmin === 'true' : false;

        // Join the group room via socket.
        socket.emit('join-group', String(selectedGroup));

        // GET messages for this group.
        const response = await axios.get(`http://localhost:3000/group/${selectedGroup}/messages`);
        const messages = response.data.map(msg => ({
            id: msg.id,
            message: msg.message,
            user: msg.user ? msg.user.name : 'Unknown',
            userId: msg.userId, // To differentiate current user.
            createdAt: msg.createdAt,
            fileUrl: msg.fileUrl
        }));

        chatMessages = messages;
        saveMessagesToLocalStorage(chatMessages, groupId);
        displayChat();
    } catch (err) {
        console.error('Error fetching group messages:', err);
    }
}

// Display chat messages on screen.
function displayChat() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';

    const currentUserId = localStorage.getItem('userId') ? parseInt(localStorage.getItem('userId'), 10) : null;
    chatMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        // Compare message sender with current user.
        const isCurrentUser = msg.userId === currentUserId;
        messageDiv.className = `chat-message ${isCurrentUser ? 'my-message' : 'other-message'}`;

        let html = `<div class="message-user">${msg.user || 'Unknown'}</div>`;
        if (msg.message) {
            html += `<div>${msg.message}</div>`;
        }
        // If there's an attached file.
        if (msg.fileUrl) {
            if (/\.(jpg|jpeg|png|gif)$/i.test(msg.fileUrl)) {
                html += `<div><img src="${msg.fileUrl}" alt="Image" style="max-width:200px;"></div>`;
            } else {
                html += `<div><a href="${msg.fileUrl}" target="_blank">Download File</a></div>`;
            }
        }
        html += `<div class="message-time">${new Date(msg.createdAt).toLocaleTimeString()}</div>`;
        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send a new message or file to the group.
async function sendChat(event) {
    event.preventDefault();
    const chatInput = document.getElementById('chat-input');
    const fileInput = document.getElementById('file-input');
    const message = chatInput.value.trim();
    const file = fileInput.files[0];

    if (!selectedGroup) {
        alert('Please select a group first.');
        return;
    }
    if (!message && !file) {
        alert("Please type a message or select a file");
        return;
    }
    try {
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('caption', message);
            await axios.post(`http://localhost:3000/group/${selectedGroup}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        } else {
            await axios.post(`http://localhost:3000/group/${selectedGroup}/message`, { message });
        }
        // Wait for the server to emit the new message.
    } catch (err) {
        console.error('Error sending message/file:', err);
        alert('Error sending message/file');
    } finally {
        chatInput.value = '';
        fileInput.value = '';
    }
}

// Create a new group.
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

// Search and add a user to the group.
async function searchAndAddUser() {
    try {
        if (!selectedGroupIsAdmin) {
            alert("You are not an admin in this group. You cannot add a user.");
            return;
        }
        const searchQuery = prompt('Enter name, email, or phone number:');
        if (!searchQuery) return;
        const response = await axios.get(`http://localhost:3000/user/search?query=${searchQuery}`);
        const users = response.data;
        if (users.length === 0) {
            alert('No users found');
            return;
        }
        const userId = prompt('Enter the ID of the user to add:');
        if (!userId) return;
        await axios.post(`http://localhost:3000/group/${selectedGroup}/add`, { userId });
        // The server will emit an event to notify the added user and refresh group members.
        alert('User added to group');
    } catch (err) {
        console.error('Error adding user:', err);
    }
}

// Make a user admin in the group.
async function makeUserAdmin() {
    try {
        if (!selectedGroupIsAdmin) {
            alert("You are not an admin in this group. You cannot make another user admin.");
            return;
        }
        const userId = prompt('Enter the ID of the user to make admin:');
        if (!userId) return;
        await axios.post(`http://localhost:3000/group/${selectedGroup}/makeAdmin`, { userId });
        // The server will emit an event to update this user and the group.
        alert('User made admin');
    } catch (err) {
        console.error('Error making user admin:', err);
    }
}

// Remove a user from the group.
async function removeUserFromGroup() {
    try {
        if (!selectedGroupIsAdmin) {
            alert("You are not an admin in this group. You cannot remove a user.");
            return;
        }
        const userId = prompt('Enter the ID of the user to remove:');
        if (!userId) return;
        await axios.post(`http://localhost:3000/group/${selectedGroup}/remove`, { userId });
        // The server will emit an event to notify the removed user and update the group.
        alert('User removed from group');
    } catch (err) {
        console.error('Error removing user:', err);
    }
}

// Socket event listener for new messages.
socket.on('new-group-message', (newMsg) => {
    // Only add the message if it belongs to the currently selected group.
    if (String(newMsg.groupId) === String(selectedGroup)) {
        chatMessages.push({
            id: newMsg.id,
            message: newMsg.message,
            user: newMsg.user?.name || 'Unknown',
            userId: newMsg.userId,
            createdAt: newMsg.createdAt,
            fileUrl: newMsg.fileUrl || null
        });
        saveMessagesToLocalStorage(chatMessages, selectedGroup);
        displayChat();
    }
});

// Socket event listener: when the user is removed from a group.
socket.on('removed-from-group', (data) => {
    if (String(selectedGroup) === String(data.groupId)) {
        alert(data.message);
        const groupSelect = document.getElementById('group-select');
        const option = groupSelect.querySelector(`option[value="${data.groupId}"]`);
        if (option) option.remove();
        if (localStorage.getItem('selectedGroup') == data.groupId) {
            localStorage.removeItem('selectedGroup');
            selectedGroup = null;
            chatMessages = [];
            displayChat();
        }
    } else {
        alert(`You have been removed from group ${data.groupId}`);
    }
});

// Socket event listener: when the user is added to a group.
socket.on('added-to-group', (data) => {
    alert(data.message);
    fetchGroups();
});

// Socket event listener: when a user is made an admin.
socket.on('updated-group-admin', (data) => {
    alert(data.message);
    fetchGroups();
});

// Socket event listener: when the group membership list updates.
socket.on('group-members-updated', (data) => {
    // Refresh the group list to reflect changes.
    fetchGroups();
});

// Listen for changes in the group selector.
document.getElementById('group-select').addEventListener('change', async () => {
    const groupId = document.getElementById('group-select').value;
    if (groupId) {
        selectedGroup = parseInt(groupId, 10);
        const selectedOption = document.querySelector(`#group-select option[value="${groupId}"]`);
        selectedGroupIsAdmin = selectedOption ? selectedOption.dataset.isAdmin === 'true' : false;
        localStorage.setItem('selectedGroup', selectedGroup);
        await fetchGroupMessages();
    }
});

// When the page loads, fetch the groups.
window.onload = async () => {
    await fetchGroups();
};
