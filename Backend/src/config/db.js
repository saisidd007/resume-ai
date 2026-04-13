const mongoose = require('mongoose')

async function connectDB() {
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to the database ");
    }
    catch(err){
        console.log("There was an error connecting to the database ");
        console.log(err);
    }

}
module.exports = connectDB;