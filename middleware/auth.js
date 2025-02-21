// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const generateAccessToken = (id, name) => {
    return jwt.sign({ userId: id, name }, process.env.JWT_SECRET);
};

const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Authentication required' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.userId);

        if (!user) return res.status(404).json({ message: 'User not found' });

        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = {
    generateAccessToken,
    authenticate
};
