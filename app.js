const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { authenticate, generateAccessToken } = require('./middleware/auth');
const User = require('./models/userModel');
const Chat = require('./models/chatModel');
const sequelize = require('./utils/database');
const Sequelize = require('sequelize');
require('dotenv').config();

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

// Socket.IO authentication
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication required'));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.userId);
        if (!user) return next(new Error('User not found'));

        socket.user = user;
        next();
    } catch (err) {
        console.error('Socket auth error:', err.message);
        next(new Error('Invalid token'));
    }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name}`);

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.name}`);
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

// User routes
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

// Chat routes
app.post('/chat/send', authenticate, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }

        const chat = await Chat.create({
            message,
            userId: req.user.id
        });

        // In POST /chat/send endpoint
        const chatWithUser = await Chat.findByPk(chat.id, {
            include: [User],
            attributes: ['id', 'message', 'createdAt'] // ➕ Explicitly select fields
        });

        // Format the response to flatten user data
        const formattedMessage = {
            id: chatWithUser.id,
            message: chatWithUser.message,
            user: chatWithUser.user.name, // ✅ Flatten to a string
            createdAt: chatWithUser.createdAt
        };

        // Broadcast and respond with formatted data
        io.emit('new-message', formattedMessage);
        res.status(200).json(formattedMessage); // ➕ Use formatted data
    } catch (err) {
        console.error('Error in /chat/send:', err);
        res.status(500).json({ message: 'Error sending message' });
    }
});

app.get('/chat/messages', authenticate, async (req, res) => {
    try {
        const lastId = parseInt(req.query.lastId) || 0;
        if (isNaN(lastId)) { // Validate lastId
            return res.status(400).json({ message: 'Invalid lastId parameter' });
        }

        const messages = await Chat.findAll({
            where: { id: { [Sequelize.Op.gt]: lastId } },
            include: [User],
            order: [['id', 'ASC']]
        });
        res.status(200).json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// Database sync and server start
sequelize.sync()
    .then(() => {
        server.listen(3000, () => console.log('Server running on port 3000'));
    })
    .catch(err => console.error('Database sync error:', err));