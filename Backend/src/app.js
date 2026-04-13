const express = require('express')
const authRouter = require('./routes/auth.routes')
const cookieParser = require('cookie-parser')
const cors= require('cors')
const app = express();
app.use(cookieParser())
app.use(cors({
    origin : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5174"],
    credentials : true
}))

app.use(express.json())

app.use('/api/auth',authRouter);

const interviewRouter = require('./routes/interview.routes');
app.use('/api/interview', interviewRouter);

module.exports = app;
