// controllers/userController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateAccessToken } = require('../middleware/auth');
const User = require('../models/userModel');
const Sequelize = require('sequelize');

exports.signup = async (req, res) => {
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
        console.error(err);
        res.status(500).json({ message: 'Error in signup' });
    }
};

exports.login = async (req, res) => {
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

        // Return userId so the frontend can highlight user messages
        res.status(200).json({
            message: 'Login successful',
            token,
            userId: user.id
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error in login' });
    }
};


exports.search = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ message: 'Search query is required' });

        const users = await User.findAll({
            where: {
                [Sequelize.Op.or]: ['name', 'email', 'number'].map(field => ({
                    [field]: { [Sequelize.Op.like]: `%${query}%` }
                }))
            }
        });
        res.json(users);
    } catch (err) {
        console.error('Error searching users:', err);
        res.status(500).json({ message: 'Error searching users' });
    }
};
