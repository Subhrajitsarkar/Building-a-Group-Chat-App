const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const Group = require('./groupModel');
const User = require('./userModel');

const GroupChat = sequelize.define('groupChat', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    message: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    fileUrl: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    groupId: {
        type: Sequelize.INTEGER,
        references: {
            model: Group,
            key: 'id'
        }
    },
    userId: {
        type: Sequelize.INTEGER,
        references: {
            model: User,
            key: 'id'
        }
    }
}, {
    timestamps: true,
    underscored: true
});

module.exports = GroupChat;
