const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const Sequelize = require('sequelize');

const { authenticate, generateAccessToken } = require('./middleware/auth');
const User = require('./models/userModel');
const Chat = require('./models/chatModel');
const Group = require('./models/groupModel');
const GroupMember = require('./models/groupMemberModel');
const GroupChat = require('./models/groupChatModel');
const sequelize = require('./utils/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        allowedHeaders: ["Authorization"],
        credentials: true
    }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Database associations
User.hasMany(Chat, { foreignKey: 'userId' });
Chat.belongsTo(User, { foreignKey: 'userId' });

User.belongsToMany(Group, { through: GroupMember, foreignKey: 'userId' });
Group.belongsToMany(User, { through: GroupMember, foreignKey: 'groupId' });
Group.hasMany(GroupChat, { foreignKey: 'groupId' });
GroupChat.belongsTo(Group, { foreignKey: 'groupId' });
GroupChat.belongsTo(User, { foreignKey: 'userId' });

// Middleware to authenticate socket connections
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) return next(new Error('Authentication error'));
            socket.user = decoded;
            next();
        });
    } else {
        next(new Error('Authentication error'));
    }
});

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join-group', (groupId) => {
        if (!groupId) return;
        socket.join(groupId); // Join the group room
        console.log(`User ${socket.id} joined group ${groupId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'signup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'login.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'chat.html'));
});

// User signup
app.post('/user/signup', async (req, res) => {
    try {
        const { name, email, number, password } = req.body;
        if (!name || !email || !number || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, number, password: hashedPassword });
        res.status(201).json({ message: 'Successfully signed up', user });
    } catch (err) {
        res.status(500).json({ message: 'Error in signup' });
    }
});

// User login
app.post('/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateAccessToken(user.id, user.name);
        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        res.status(500).json({ message: 'Error in login' });
    }
});

// Create a new group
app.post('/group', authenticate, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Group name is required' });

        const group = await Group.create({ name, createdBy: req.user.id });
        await GroupMember.create({ userId: req.user.id, groupId: group.id, isAdmin: true }); // Add creator as an admin
        res.status(201).json({ message: 'Group created', group });
    } catch (err) {
        console.error('Error creating group:', err);
        res.status(500).json({ message: 'Error creating group' });
    }
});

//make a group admin
app.post('/group/:groupId/makeAdmin', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = Number(req.body.userId);

        const group = await Group.findByPk(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        const isAdmin = await GroupMember.findOne({
            where: { groupId, userId: req.user.id, isAdmin: true }
        });
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only group admins can make other members admin' });
        }

        await GroupMember.update({ isAdmin: true }, { where: { groupId, userId } });
        res.status(200).json({ message: 'User made admin' });
    } catch (err) {
        console.error('Error making user admin:', err);
        res.status(500).json({ message: 'Error making user admin' });
    }
});

//remove user from a group
app.post('/group/:groupId/remove', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = Number(req.body.userId);

        const group = await Group.findByPk(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        const isAdmin = await GroupMember.findOne({
            where: { groupId, userId: req.user.id, isAdmin: true }
        });
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only group admins can remove members' });
        }

        await GroupMember.destroy({ where: { groupId, userId } });
        res.status(200).json({ message: 'User removed from group' });
    } catch (err) {
        console.error('Error removing user from group:', err);
        res.status(500).json({ message: 'Error removing user from group' });
    }
});

//search user in a group
app.get('/users/search', authenticate, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ message: 'Search query is required' });

        const users = await User.findAll({
            where: {
                [Sequelize.Op.or]: [
                    { name: { [Sequelize.Op.like]: `%${query}%` } },
                    { email: { [Sequelize.Op.like]: `%${query}%` } },
                    { number: { [Sequelize.Op.like]: `%${query}%` } }
                ]
            }
        });

        res.json(users);
    } catch (err) {
        console.error('Error searching users:', err);
        res.status(500).json({ message: 'Error searching users' });
    }
});

// Add user to a group
app.post('/group/:groupId/add', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        // Convert the userId to a number if needed
        const userId = Number(req.body.userId);

        const group = await Group.findByPk(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Ensure the requester is an admin
        const isAdmin = await GroupMember.findOne({
            where: { groupId, userId: req.user.id, isAdmin: true }
        });
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only group admins can add members' });
        }

        await GroupMember.create({ userId, groupId });
        res.status(200).json({ message: 'User added to group' });
    } catch (err) {
        console.error('Error adding user to group:', err);
        res.status(500).json({ message: 'Error adding user to group' });
    }
});

app.post('/group/:groupId/message', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;

        if (!message) return res.status(400).json({ message: 'Message is required' });

        // Save the message to the database
        const newMessage = await GroupChat.create({
            message,
            groupId,
            userId
        });

        // Fetch the message along with the user details
        const populatedMessage = await GroupChat.findOne({
            where: { id: newMessage.id },
            include: [{ model: User, attributes: ['name'] }]
        });

        // Broadcast to the group room
        io.to(groupId).emit('new-group-message', {
            id: populatedMessage.id,
            message: populatedMessage.message,
            user: populatedMessage.user.name,
            createdAt: populatedMessage.createdAt,
            groupId: populatedMessage.groupId
        });

        res.status(201).json(populatedMessage);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch groups for a user
app.get('/groups', authenticate, async (req, res) => {
    try {
        // Return groups along with join table attributes (isAdmin)
        const groups = await req.user.getGroups({
            joinTableAttributes: ['isAdmin']
        });
        res.json(groups);
    } catch (err) {
        console.error('Error fetching groups:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch messages for a group
app.get('/group/:groupId/messages', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        const messages = await GroupChat.findAll({
            where: { groupId },
            include: [{ model: User, attributes: ['name'] }],
            order: [['createdAt', 'ASC']]
        });
        res.json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/chat/send', async (req, res) => {
    try {
        const { message, groupId } = req.body; // Expect groupId from the client

        if (!message || !groupId) {
            return res.status(400).json({ error: 'Message and groupId are required' });
        }

        // Save the message to the database
        const newMessage = await saveMessageToDatabase({
            message,
            groupId,
            userId: req.user.id, // Assuming you have user authentication middleware
        });

        // Broadcast the new message to clients in the same group
        io.to(`group-${groupId}`).emit('new-group-message', newMessage);

        // Respond with the saved message
        res.status(201).json(newMessage);
    } catch (err) {
        console.error('Error sending message:', err.message);
        res.status(500).json({ error: 'Failed to send message' });
    }
});


// Database sync and server start
sequelize.sync({ alter: true })
    .then(() => {
        server.listen(3000, () => console.log('Server running on port 3000'));
    })
    .catch(err => console.error('Database sync error:', err));