// controllers/chatController.js
const Chat = require('../models/chatModel');
const GroupChat = require('../models/groupChatModel');

exports.sendChat = async (req, res) => {
    try {
        const { message, groupId } = req.body;
        if (!message || !groupId) {
            return res.status(400).json({ error: 'Message and groupId are required' });
        }
        // Store the message in GroupChat.
        const newMessage = await GroupChat.create({
            message,
            groupId,
            userId: req.user.id
        });
        // Emit the new message to all clients in the room named with the groupId.
        const io = req.app.get('io');
        io.to(String(groupId)).emit('new-group-message', newMessage);
        res.status(201).json(newMessage);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
};
