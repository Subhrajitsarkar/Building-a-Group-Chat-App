const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

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
        allowNull: false
    }
});

module.exports = Chat;