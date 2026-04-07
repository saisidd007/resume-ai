const app = require('./src/app');
const connectDB = require('./src/config/db')
require("dotenv").config()

app.listen(3000,()=>{
    console.log("The app is running on the port 3000");
})

connectDB();
