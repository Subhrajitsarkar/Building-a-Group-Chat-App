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
        socket.emit('join-group', String(selectedGroup));

        // Fetch messages from the server
        const response = await axios.get(`http://localhost:3000/group/${selectedGroup}/messages`);
        const newMessages = response.data.map(msg => ({
            id: msg.id,
            message: msg.message,
            user: msg.user ? msg.user.name : 'Unknown',
            createdAt: msg.createdAt,
            fileUrl: msg.fileUrl // Include fileUrl if it exists
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
    const currentUserId = localStorage.getItem('userId');

    chatMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        const isCurrentUser = msg.userId === parseInt(currentUserId, 10);
        messageDiv.className = `chat-message ${isCurrentUser ? 'my-message' : 'other-message'}`;

        // User info and text (if any)
        let html = `<div class="message-user">${msg.user || 'Unknown'}</div>`;
        if (msg.message) {
            html += `<div>${msg.message}</div>`;
        }

        // If there is an attached file, display a link or preview
        if (msg.fileUrl) {
            // For images, display a preview:
            if (/\.(jpg|jpeg|png|gif)$/i.test(msg.fileUrl)) {
                html += `<div><img src="${msg.fileUrl}" alt="Image" style="max-width:200px;"></div>`;
            } else {
                // For other files, provide a download link.
                html += `<div><a href="${msg.fileUrl}" target="_blank">Download File</a></div>`;
            }
        }

        html += `<div class="message-time">${new Date(msg.createdAt).toLocaleTimeString()}</div>`;
        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Sends a new message to the group (without optimistic update)
async function sendChat(event) {
    event.preventDefault();
    const chatInput = document.getElementById('chat-input');
    const fileInput = document.getElementById('file-input');
    const message = chatInput.value.trim();
    const file = fileInput.files[0];

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
        // Do NOT add the message here. Wait for the socket event to update.
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

// Update the socket listener to handle user.name correctly
socket.on('new-group-message', (newMsg) => {
    if (String(newMsg.groupId) === String(selectedGroup)) {
        chatMessages.push({
            id: newMsg.id,
            message: newMsg.message,
            user: newMsg.user?.name || 'Unknown', // Safely access user name
            createdAt: newMsg.createdAt,
            fileUrl: newMsg.fileUrl || null
        });
        saveMessagesToLocalStorage(chatMessages, selectedGroup);
        displayChat();
    }
});


async function uploadFile() {
    try {
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a file to upload.');
            return;
        }
        if (!selectedGroup) {
            alert('Please select a group first.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        // Optionally, allow the user to add a caption:
        // formData.append('caption', 'Optional caption text');

        // Send the file to the server
        const response = await axios.post(`http://localhost:3000/group/${selectedGroup}/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        // The new message (with fileUrl) is also broadcast via Socket.IO,
        // so your socket listener will update the chat.
        fileInput.value = ''; // clear the input
    } catch (err) {
        console.error('Error uploading file:', err.response?.data?.message || err.message);
        alert('Error uploading file');
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