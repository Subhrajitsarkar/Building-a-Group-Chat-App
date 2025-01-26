let express = require('express')
let app = express()
let bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.json())
let path = require('path')
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')
let cors = require('cors')
app.use(cors())
let User = require('./models/userModel')
let sequelize = require('./utils/database')
require('dotenv').config()

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'signup.html'))
})
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'login.html'))
})

app.post('/user/signup', async (req, res) => {
    try {
        let { name, email, number, password } = req.body

        if (!name || !email || !number || !password)
            throw new Error('all fields are required')

        let existingUser = await User.findOne({ where: { email } })
        if (existingUser)
            return res.status(409).json({ message: 'User already exists' })

        let hashedPassword = await bcrypt.hash(password, 10)
        let response = await User.create({ name, email, number, password: hashedPassword })
        res.status(201).json({ response })
    } catch (err) {
        console.log(err);

        res.status(500).json({ message: 'error in signup backend' })
    }
})

async function generateAccessToken(id, name) {
    return jwt.sign({ userId: id, name }, process.env.JWT_SECRET)
}
exports.generateAccessToken = generateAccessToken

app.post('/user/login', async (req, res) => {
    try {
        let { email, password } = req.body
        if (!email || !password)
            throw new Error('All fields are required')
        const user = await User.findOne({ where: { email } })
        if (!user)
            return res.status(404).json({ message: 'User not found' })
        let isPasswordValid = await bcrypt.compare(password, user.password)
        const token = await generateAccessToken(user.id, user.name);
        if (isPasswordValid)
            res.status(200).json({ message: 'Welcome to chat app', token: token })
        else
            return res.status(401).json({ message: 'Invalid credentials' });
    } catch (err) {

    }
})

sequelize.sync()
    .then(() => {
        app.listen(3000, () => console.log('server running on PORT 3000'))
    })