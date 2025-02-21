// models/groupMemberModel.js
const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const User = require('./userModel');
const Group = require('./groupModel');

const GroupMember = sequelize.define('groupMember', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: Sequelize.INTEGER,
        references: {
            model: User,
            key: 'id'
        }
    },
    groupId: {
        type: Sequelize.INTEGER,
        references: {
            model: Group,
            key: 'id'
        }
    },
    isAdmin: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true,
    underscored: true
});

module.exports = GroupMember;
