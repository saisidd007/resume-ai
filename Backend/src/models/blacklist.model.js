const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [true, "Token is required"],
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '1d' // auto delete after 1 day
    }
});

const blacklistModel = mongoose.model("blacklisttoken", blacklistSchema);

module.exports = blacklistModel;