

const jwt = require("jsonwebtoken");
const blacklistModel = require("../models/blacklist.model");

async function authUser(req, res, next) {
    try {
        // 1. Get token from cookies
        const token = req.cookies.token;
        

        if (!token) {
            return res.status(401).json({
                message: "Token not provided"
            });
        }

        // 2. Check if token is blacklisted
        const isBlacklisted = await blacklistModel.findOne({ token });

        if (isBlacklisted) {
            return res.status(401).json({
                message: "Token is blacklisted"
            });
        }

        // 3. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Attach user to request
        req.user = decoded;

        // 5. Continue
        next();

    } catch (err) {
        return res.status(401).json({
            message: "Invalid token"
        });
    }
}

module.exports = {authUser};