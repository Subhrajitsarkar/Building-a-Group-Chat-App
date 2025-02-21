// utils/database.js
const Sequelize = require('sequelize');

const sequelize = new Sequelize('chat', 'root', 'Password', {
    dialect: 'mysql',
    host: 'localhost'
});

module.exports = sequelize;
