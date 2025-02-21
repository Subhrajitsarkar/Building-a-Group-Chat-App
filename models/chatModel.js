// models/chatModel.js
const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const User = require('./userModel');

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
            model: User,
            key: 'id'
        }
    }
}, {
    timestamps: true,
    underscored: true
});

// Association
Chat.belongsTo(User, { foreignKey: 'userId' });

module.exports = Chat;
