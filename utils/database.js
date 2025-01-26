let Sequelize = require('sequelize')
let sequelize = new Sequelize('chat', 'root', 'Password', {
    dialect: 'mysql',
    host: 'localhost'
})
module.exports = sequelize;