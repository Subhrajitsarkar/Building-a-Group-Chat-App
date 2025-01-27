const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { authenticate, generateAccessToken } = require('./middleware/auth');
const User = require('./models/userModel');
const Chat = require('./models/chatModel');
const sequelize = require('./utils/database');
require('dotenv').config();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Set up associations
User.hasMany(Chat);
Chat.belongsTo(User);

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
        res.status(201).json({ user });
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

// Chat endpoints
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

        const chatWithUser = await Chat.findByPk(chat.id, {
            include: [User]
        });

        res.status(200).json(chatWithUser);
    } catch (err) {
        res.status(500).json({ message: 'Error sending message' });
    }
});

app.get('/chat/messages', authenticate, async (req, res) => {
    try {
        const messages = await Chat.findAll({
            include: [User],
            order: [['createdAt', 'ASC']]
        });
        res.status(200).json(messages);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// Database sync and server start
sequelize.sync()
    .then(() => {
        app.listen(3000, () => console.log('Server running on port 3000'));
    })
    .catch(err => console.error('Database sync error:', err));