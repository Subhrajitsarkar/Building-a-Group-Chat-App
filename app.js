let express = require('express')
let app = express()
let bosyParser = require('body-parser')
app.use(bosyParser.urlencoded({ extended: false }))
let path = require('path')
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')
let cors = require('cors')
app.use(cors())
let User = require('./models/userModel')
let sequelize = require('./utils/database')

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'signup.html'))
})

app.post('/user/signup', async (req, res) => {
    try {
        let { name, email, number, password } = req.body

        if (!name || !email || !number || !password)
            throw new Error('all fields are required')

        let existingUser = await User.findOne({ Where: { email } })
        if (existingUser)
            return res.status(409).json({ message: 'User already exists' })

        let hashedPassword = bcrypt.hash(password, 10)
        let response = await User.create({ name, email, number, password: hashedPassword })
        res.status(201).json({ response })
    } catch (err) {
        res.status(500).json({ message: 'error in signup backend' })
    }
})

sequelize.sync()
    .then(() => {
        app.listen(3000, () => console.log('server running on PORT 3000'))
    })