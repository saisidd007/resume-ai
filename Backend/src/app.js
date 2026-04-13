const express = require('express')
const authRouter = require('./routes/auth.routes')
const cookieParser = require('cookie-parser')
const cors= require('cors')
const app = express();
app.use(cookieParser())
app.use(cors({
    origin : true, // Automatically allows the requesting domain (like Vercel)
    credentials : true
}))

app.use(express.json())

app.use('/api/auth',authRouter);

const interviewRouter = require('./routes/interview.routes');
app.use('/api/interview', interviewRouter);

module.exports = app;
