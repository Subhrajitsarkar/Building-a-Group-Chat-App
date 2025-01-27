const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const User = require('../models/userModel');

const Chat = sequelize.define('chat', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    message: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: User, // Reference User model
            key: 'id'
        }
    }
}, {
    timestamps: true,
    underscored: true
});

// Define the association
Chat.belongsTo(User, { foreignKey: 'userId' });

module.exports = Chat;