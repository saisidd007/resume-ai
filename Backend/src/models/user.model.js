const mongoose = require('mongoose');

const userSchema = new mongoose.Schema.create({
    username : {
        type : String,
        unique : [true,"username already taken"],
        required : true
    },
    email : {
        type : String ,
        unique : [true,"Email already taken "],
        required : true
    },
    password : {
        type : String ,
        required : true
    }

})

const userModel = mongoose.model("user",userSchema)

module.exports = userModel;