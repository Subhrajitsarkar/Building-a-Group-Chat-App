// Array to store all chat messages
let chatMessages = [];

async function sendChat(event) {
    try {
        event.preventDefault();
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();

        if (!message) {
            throw new Error('Message cannot be empty');
        }

        let chatObj = { message };

        let response = await axios.post('http://localhost:3000/chat/send', chatObj);

        if (response.status === 200) {
            chatMessages.push(response.data.message); // Add message to local chat array
            displayChat(); // Update chat display
        }

        chatInput.value = ''; // Clear input
    } catch (err) {
        document.body.innerHTML += `<div>${err.message}</div>`;
    }
}

function displayChat() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = ''; // Clear previous messages
    chatMessages.forEach((message) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.textContent = message;
        messagesContainer.appendChild(messageDiv);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
}
