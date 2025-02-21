// public/js/chat.js

let chatMessages = [];
let selectedGroup = null;
let selectedGroupIsAdmin = false;

// Socket.IO client connection
const socket = io('http://localhost:3000', {
    auth: { token: localStorage.getItem('token') }
});

// Automatically attach the JWT token to every Axios request header.
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Save the last 10 messages to localStorage (per group)
function saveMessagesToLocalStorage(messages, groupId) {
    const recentMessages = messages.slice(-10);
    localStorage.setItem(`chatMessages_${groupId}`, JSON.stringify(recentMessages));
}

// Load messages from localStorage
function loadMessagesFromLocalStorage(groupId) {
    const storedMessages = localStorage.getItem(`chatMessages_${groupId}`);
    return storedMessages ? JSON.parse(storedMessages) : [];
}

// Fetch all groups the user belongs to
async function fetchGroups() {
    try {
        const response = await axios.get('http://localhost:3000/group');
        const groups = response.data;
        const groupSelect = document.getElementById('group-select');
        groupSelect.innerHTML = `<option value="">Select a Group</option>`;

        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            // group.groupMember might contain { isAdmin: true/false }
            option.dataset.isAdmin = group.groupMember ? group.groupMember.isAdmin : false;
            groupSelect.appendChild(option);
        });

        // Check if we have a previously selected group in localStorage
        const lastSelectedGroup = localStorage.getItem('selectedGroup');
        if (lastSelectedGroup && groups.find(g => g.id == lastSelectedGroup)) {
            groupSelect.value = lastSelectedGroup;
            selectedGroup = parseInt(lastSelectedGroup, 10);

            // Also set admin status
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

        // Update admin status from the selected option
        const selectedOption = document.querySelector(`#group-select option[value="${groupId}"]`);
        selectedGroupIsAdmin = selectedOption ? selectedOption.dataset.isAdmin === 'true' : false;

        // Join the group room via socket
        socket.emit('join-group', String(selectedGroup));

        // Fetch messages from server
        const response = await axios.get(`http://localhost:3000/group/${selectedGroup}/messages`);
        const newMessages = response.data.map(msg => ({
            id: msg.id,
            message: msg.message,
            user: msg.user ? msg.user.name : 'Unknown',
            userId: msg.userId,           // So we can compare with currentUserId
            createdAt: msg.createdAt,
            fileUrl: msg.fileUrl
        }));

        chatMessages = newMessages;
        saveMessagesToLocalStorage(chatMessages, groupId);
        displayChat();
    } catch (err) {
        console.error('Error fetching group messages:', err);
    }
}

// Render chat messages in the UI
function displayChat() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';

    const currentUserId = localStorage.getItem('userId')
        ? parseInt(localStorage.getItem('userId'), 10)
        : null;

    chatMessages.forEach(msg => {
        const messageDiv = document.createElement('div');

        // Check if this message belongs to the current user
        const isCurrentUser = msg.userId === currentUserId;
        messageDiv.className = `chat-message ${isCurrentUser ? 'my-message' : 'other-message'}`;

        let html = `<div class="message-user">${msg.user || 'Unknown'}</div>`;
        if (msg.message) {
            html += `<div>${msg.message}</div>`;
        }

        // If there's a file, show it
        if (msg.fileUrl) {
            // If it's an image
            if (/\.(jpg|jpeg|png|gif)$/i.test(msg.fileUrl)) {
                html += `<div><img src="${msg.fileUrl}" alt="Image" style="max-width:200px;"></div>`;
            } else {
                // For non-image files, provide a link
                html += `<div><a href="${msg.fileUrl}" target="_blank">Download File</a></div>`;
            }
        }

        html += `<div class="message-time">${new Date(msg.createdAt).toLocaleTimeString()}</div>`;
        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send a new message or file to the group
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
        // The new message will arrive via socket.io event below
    } catch (err) {
        console.error('Error sending message/file:', err);
        alert('Error sending message/file');
    } finally {
        chatInput.value = '';
        fileInput.value = '';
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

// Search for a user and add them to the group
async function searchAndAddUser() {
    try {
        if (!selectedGroupIsAdmin) {
            alert("You are not an admin in this group. You cannot add a user.");
            return;
        }
        const searchQuery = prompt('Enter name, email, or phone number:');
        if (!searchQuery) return;

        // Updated route: /user/search instead of /users/search
        const response = await axios.get(`http://localhost:3000/user/search?query=${searchQuery}`);
        const users = response.data;

        if (users.length === 0) {
            alert('No users found');
            return;
        }

        // Let admin pick which user ID to add
        const userId = prompt(
            `Found ${users.length} user(s). Enter the ID of the user to add:`
        );
        if (!userId) return;

        await axios.post(`http://localhost:3000/group/${selectedGroup}/add`, { userId });
        alert('User added to group');
    } catch (err) {
        console.error('Error searching and adding user:', err);
    }
}

// Make a user admin
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

// Remove a user from group
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

// Listen for new group messages from socket.io
socket.on('new-group-message', (newMsg) => {
    // Only update if the message belongs to the currently selected group
    if (String(newMsg.groupId) === String(selectedGroup)) {
        chatMessages.push({
            id: newMsg.id,
            message: newMsg.message,
            user: newMsg.user?.name || 'Unknown',
            userId: newMsg.userId,   // Make sure we have userId in the data
            createdAt: newMsg.createdAt,
            fileUrl: newMsg.fileUrl || null
        });
        saveMessagesToLocalStorage(chatMessages, selectedGroup);
        displayChat();
    }
});

// Refresh the chat/groups
function refreshChat() {
    fetchGroups();
    if (selectedGroup) {
        fetchGroupMessages();
    }
}

// On window load, fetch groups
window.onload = async () => {
    await fetchGroups();
    // If you want to auto-fetch messages for the last group, it happens in fetchGroups.
};
