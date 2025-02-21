// controllers/groupController.js
const Group = require('../models/groupModel');
const GroupMember = require('../models/groupMemberModel');
const GroupChat = require('../models/groupChatModel');
const User = require('../models/userModel');

exports.createGroup = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Group name is required' });

        const group = await Group.create({ name, createdBy: req.user.id });
        await GroupMember.create({ userId: req.user.id, groupId: group.id, isAdmin: true });
        res.status(201).json({ message: 'Group created', group });
    } catch (err) {
        console.error('Error creating group:', err);
        res.status(500).json({ message: 'Error creating group' });
    }
};

exports.makeAdmin = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;

        const group = await Group.findByPk(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Check if the requester is an admin
        const isAdmin = await GroupMember.findOne({ where: { groupId, userId: req.user.id, isAdmin: true } });
        if (!isAdmin) return res.status(403).json({ message: 'Only admins can make others admins' });

        await GroupMember.update({ isAdmin: true }, { where: { groupId, userId } });
        res.json({ message: 'User made admin' });
    } catch (err) {
        console.error('Error making user admin:', err);
        res.status(500).json({ message: 'Error making user admin' });
    }
};

exports.removeUser = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;

        const group = await Group.findByPk(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Check if the requester is an admin
        const isAdmin = await GroupMember.findOne({ where: { groupId, userId: req.user.id, isAdmin: true } });
        if (!isAdmin) return res.status(403).json({ message: 'Only admins can remove members' });

        await GroupMember.destroy({ where: { groupId, userId } });
        res.json({ message: 'User removed from group' });
    } catch (err) {
        console.error('Error removing user from group:', err);
        res.status(500).json({ message: 'Error removing user from group' });
    }
};

exports.addUser = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = Number(req.body.userId);

        const group = await Group.findByPk(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Check if the requester is an admin
        const isAdmin = await GroupMember.findOne({ where: { groupId, userId: req.user.id, isAdmin: true } });
        if (!isAdmin) return res.status(403).json({ message: 'Only admins can add members' });

        await GroupMember.create({ userId, groupId });
        res.json({ message: 'User added to group' });
    } catch (err) {
        console.error('Error adding user to group:', err);
        res.status(500).json({ message: 'Error adding user to group' });
    }
};

exports.postGroupMessage = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { message } = req.body;
        if (!message) return res.status(400).json({ message: 'Message is required' });

        const newMessage = await GroupChat.create({ message, groupId, userId: req.user.id });

        let populatedMessage = await GroupChat.findOne({
            where: { id: newMessage.id },
            include: [{ model: User, attributes: ['name'] }]
        });

        // Convert to plain object so it is easily serializable
        populatedMessage = populatedMessage.get({ plain: true });

        // Emit the message via socket.io
        const io = req.app.get('io');
        io.to(String(groupId)).emit('new-group-message', populatedMessage);

        res.status(201).json(populatedMessage);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getGroupMessages = async (req, res) => {
    try {
        const messages = await GroupChat.findAll({
            where: { groupId: req.params.groupId },
            include: [{ model: User, attributes: ['name'] }],
            order: [['createdAt', 'ASC']]
        });
        res.json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'File is required' });

        const { groupId } = req.params;
        const newMessage = await GroupChat.create({
            message: req.body.caption || '',
            fileUrl: req.file.location, // from multer-S3
            groupId,
            userId: req.user.id
        });

        const populatedMessage = await GroupChat.findOne({
            where: { id: newMessage.id },
            include: [{ model: User, attributes: ['name'] }]
        });

        // Emit the uploaded file message
        const io = req.app.get('io');
        io.to(String(groupId)).emit('new-group-message', populatedMessage);

        res.status(201).json(populatedMessage);
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: 'File upload failed' });
    }
};

exports.getAllGroups = async (req, res) => {
    try {
        // Using Sequelize magic method getGroups()
        const groups = await req.user.getGroups({ joinTableAttributes: ['isAdmin'] });
        res.json(groups);
    } catch (err) {
        console.error('Error fetching groups:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
