// app.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const sequelize = require('./utils/database');

// Import Models
const User = require('./models/userModel');
const Chat = require('./models/chatModel');
const Group = require('./models/groupModel');
const GroupMember = require('./models/groupMemberModel');
const GroupChat = require('./models/groupChatModel');

// Import Routes
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Initialize Express and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "http://localhost:3000" } });

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Database Relationships
User.hasMany(Chat);
Chat.belongsTo(User);
User.belongsToMany(Group, { through: GroupMember });
Group.belongsToMany(User, { through: GroupMember });
Group.hasMany(GroupChat);
GroupChat.belongsTo(Group);
GroupChat.belongsTo(User);

// Make Socket.IO instance accessible to controllers
app.set('io', io);

// Socket.IO Authentication Middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) return next(new Error('Authentication error'));
            socket.user = decoded; // decoded contains user info, e.g., { userId, name }
            next();
        });
    } else {
        next(new Error('Authentication error'));
    }
});

// Socket.IO Connection and Events
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join a personal room using user id for targeted notifications
    if (socket.user && socket.user.userId) {
        socket.join(`user-${socket.user.userId}`);
    }

    // Listen for group join events
    socket.on('join-group', (groupId) => {
        if (!groupId) return;
        socket.join(groupId); // Join room named with the groupId
        console.log(`User ${socket.id} joined group ${groupId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Serve static pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'signup.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'login.html'));
});
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'chat.html'));
});

// Use the route modules
app.use('/user', userRoutes);
app.use('/group', groupRoutes);
app.use('/chat', chatRoutes);

// Sync Database and Start Server
sequelize.sync({ alter: true })
    .then(() => {
        server.listen(3000, () => console.log('Server running on port 3000'));
    })
    .catch(err => console.error('Database sync error:', err));