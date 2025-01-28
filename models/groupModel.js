const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const Group = sequelize.define('group', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    createdBy: {
        type: Sequelize.INTEGER, // Reference to the user who created the group
        allowNull: false
    }
}, {
    timestamps: true,
    underscored: true
});

module.exports = Group;
